/**
 * Plan Mode Class
 * Core plan management functionality
 */

import type { Plan, PlanParams, GatheredInfo, ProposedPlan, PlanStep, ApprovalContext, ApprovalPrompt } from './types'
import { PLAN_STATUS, PLAN_REQUIRED_COMMANDS, DESTRUCTIVE_COMMANDS, PLANNING_TOOLS } from './constants'
import { generateApprovalPrompt } from './approval'
import { generateUUID } from '../../schemas'

export class PlanMode {
  activePlans: Map<string, Plan>

  constructor() {
    this.activePlans = new Map() // projectId -> plan state
  }

  /**
   * Check if command requires planning mode
   */
  requiresPlanning(commandName: string): boolean {
    return PLAN_REQUIRED_COMMANDS.includes(commandName)
  }

  /**
   * Check if command is destructive and needs approval
   */
  isDestructive(commandName: string): boolean {
    return DESTRUCTIVE_COMMANDS.includes(commandName)
  }

  /**
   * Check if tool is allowed in planning mode
   */
  isToolAllowedInPlanning(toolName: string): boolean {
    return PLANNING_TOOLS.includes(toolName)
  }

  /**
   * Get allowed tools for current mode
   */
  getAllowedTools(inPlanningMode: boolean, templateTools: string[]): string[] {
    if (!inPlanningMode) {
      return templateTools
    }
    // In planning mode, only allow read-only tools
    return templateTools.filter((tool) => PLANNING_TOOLS.includes(tool))
  }

  /**
   * Start planning mode for a command
   */
  startPlanning(projectId: string, commandName: string, params: PlanParams): Plan {
    const plan: Plan = {
      id: generateUUID(),
      projectId,
      command: commandName,
      params,
      status: PLAN_STATUS.GATHERING,
      startedAt: new Date().toISOString(),
      gatheredInfo: [],
      analysis: null,
      proposedPlan: null,
      userFeedback: null,
      approvedAt: null,
      executionStartedAt: null,
      completedAt: null,
      steps: [],
      currentStep: 0,
    }

    this.activePlans.set(projectId, plan)
    return plan
  }

  /**
   * Get active plan for project
   */
  getActivePlan(projectId: string): Plan | null {
    return this.activePlans.get(projectId) || null
  }

  /**
   * Check if project is in planning mode
   */
  isInPlanningMode(projectId: string): boolean {
    const plan = this.getActivePlan(projectId)
    if (!plan) return false
    return [PLAN_STATUS.GATHERING, PLAN_STATUS.ANALYZING, PLAN_STATUS.PROPOSING, PLAN_STATUS.PENDING_APPROVAL].includes(
      plan.status
    )
  }

  /**
   * Record gathered information
   */
  recordGatheredInfo(projectId: string, info: GatheredInfo): void {
    const plan = this.getActivePlan(projectId)
    if (!plan) return

    plan.gatheredInfo.push({
      ...info,
      gatheredAt: new Date().toISOString(),
    })
  }

  /**
   * Update plan status
   */
  updateStatus(projectId: string, status: string): void {
    const plan = this.getActivePlan(projectId)
    if (!plan) return

    plan.status = status

    // Track timestamps for key transitions
    if (status === PLAN_STATUS.APPROVED) {
      plan.approvedAt = new Date().toISOString()
    } else if (status === PLAN_STATUS.EXECUTING) {
      plan.executionStartedAt = new Date().toISOString()
    } else if (status === PLAN_STATUS.COMPLETED || status === PLAN_STATUS.ABORTED) {
      plan.completedAt = new Date().toISOString()
    }
  }

  /**
   * Set analysis results
   */
  setAnalysis(projectId: string, analysis: unknown): void {
    const plan = this.getActivePlan(projectId)
    if (!plan) return

    plan.analysis = analysis
    plan.status = PLAN_STATUS.ANALYZING
  }

  /**
   * Propose a plan for user approval
   */
  proposePlan(projectId: string, proposedPlan: ProposedPlan): ReturnType<typeof this.formatPlanForApproval> | null {
    const plan = this.getActivePlan(projectId)
    if (!plan) return null

    plan.proposedPlan = proposedPlan
    plan.status = PLAN_STATUS.PENDING_APPROVAL

    return this.formatPlanForApproval(plan)
  }

  /**
   * Format plan for user approval display
   */
  formatPlanForApproval(plan: Plan) {
    const proposed = plan.proposedPlan

    return {
      summary: proposed?.summary || `Plan for: ${plan.command}`,
      approach: proposed?.approach,
      steps: proposed?.steps || [],
      risks: proposed?.risks || [],
      alternatives: proposed?.alternatives || [],
      estimatedTime: proposed?.estimatedTime,
      affectedFiles: proposed?.affectedFiles || [],
      requiresConfirmation: true,
      planId: plan.id,
    }
  }

  /**
   * User approves the plan
   */
  approvePlan(
    projectId: string,
    feedback: string | null = null
  ): { approved: boolean; planId: string; steps: PlanStep[]; message: string } | null {
    const plan = this.getActivePlan(projectId)
    if (!plan || plan.status !== PLAN_STATUS.PENDING_APPROVAL) {
      return null
    }

    plan.userFeedback = feedback
    plan.status = PLAN_STATUS.APPROVED
    plan.approvedAt = new Date().toISOString()

    // Convert proposed plan to executable steps
    plan.steps = (plan.proposedPlan?.steps || []).map((step, index) => ({
      index,
      description: typeof step === 'string' ? step : step.description || '',
      status: 'pending' as const,
      tool: typeof step === 'string' ? undefined : step.tool,
      args: typeof step === 'string' ? undefined : step.args,
    }))

    return {
      approved: true,
      planId: plan.id,
      steps: plan.steps,
      message: `Plan approved. ${plan.steps.length} steps to execute.`,
    }
  }

  /**
   * User rejects the plan
   */
  rejectPlan(
    projectId: string,
    reason: string | null = null
  ): { rejected: boolean; planId: string; reason: string | null; message: string } | null {
    const plan = this.getActivePlan(projectId)
    if (!plan) return null

    plan.status = PLAN_STATUS.REJECTED
    plan.userFeedback = reason
    plan.completedAt = new Date().toISOString()

    // Clear active plan
    this.activePlans.delete(projectId)

    return {
      rejected: true,
      planId: plan.id,
      reason,
      message: 'Plan rejected. No changes made.',
    }
  }

  /**
   * Start executing approved plan
   */
  startExecution(projectId: string): ReturnType<typeof this.getNextStep> {
    const plan = this.getActivePlan(projectId)
    if (!plan || plan.status !== PLAN_STATUS.APPROVED) {
      return null
    }

    plan.status = PLAN_STATUS.EXECUTING
    plan.executionStartedAt = new Date().toISOString()
    plan.currentStep = 0

    return this.getNextStep(projectId)
  }

  /**
   * Get next step to execute
   */
  getNextStep(
    projectId: string
  ): { stepNumber: number; totalSteps: number; step: PlanStep; progress: number } | null {
    const plan = this.getActivePlan(projectId)
    if (!plan || plan.status !== PLAN_STATUS.EXECUTING) {
      return null
    }

    const step = plan.steps[plan.currentStep]
    if (!step) {
      // All steps complete
      this.completePlan(projectId)
      return null
    }

    return {
      stepNumber: plan.currentStep + 1,
      totalSteps: plan.steps.length,
      step,
      progress: Math.round((plan.currentStep / plan.steps.length) * 100),
    }
  }

  /**
   * Mark current step as complete
   */
  completeStep(projectId: string, result: unknown = {}): ReturnType<typeof this.getNextStep> {
    const plan = this.getActivePlan(projectId)
    if (!plan || plan.status !== PLAN_STATUS.EXECUTING) {
      return null
    }

    // Update current step
    plan.steps[plan.currentStep].status = 'completed'
    plan.steps[plan.currentStep].result = result
    plan.steps[plan.currentStep].completedAt = new Date().toISOString()

    // Move to next step
    plan.currentStep++

    return this.getNextStep(projectId)
  }

  /**
   * Mark step as failed
   */
  failStep(projectId: string, error: string): { failed: boolean; step: number; error: string; options: string[] } | null {
    const plan = this.getActivePlan(projectId)
    if (!plan) return null

    plan.steps[plan.currentStep].status = 'failed'
    plan.steps[plan.currentStep].error = error

    return {
      failed: true,
      step: plan.currentStep + 1,
      error,
      options: ['retry', 'skip', 'abort'],
    }
  }

  /**
   * Complete the plan
   */
  completePlan(projectId: string) {
    const plan = this.getActivePlan(projectId)
    if (!plan) return null

    plan.status = PLAN_STATUS.COMPLETED
    plan.completedAt = new Date().toISOString()

    const summary = {
      planId: plan.id,
      command: plan.command,
      totalSteps: plan.steps.length,
      completedSteps: plan.steps.filter((s) => s.status === 'completed').length,
      failedSteps: plan.steps.filter((s) => s.status === 'failed').length,
      duration: this._calculateDuration(plan.executionStartedAt, plan.completedAt),
    }

    // Clear active plan
    this.activePlans.delete(projectId)

    return summary
  }

  /**
   * Abort plan execution
   */
  abortPlan(projectId: string, reason: string = 'User requested') {
    const plan = this.getActivePlan(projectId)
    if (!plan) return null

    plan.status = PLAN_STATUS.ABORTED
    plan.completedAt = new Date().toISOString()
    plan.abortReason = reason

    const summary = {
      aborted: true,
      planId: plan.id,
      reason,
      completedSteps: plan.steps.filter((s) => s.status === 'completed').length,
      totalSteps: plan.steps.length,
    }

    // Clear active plan
    this.activePlans.delete(projectId)

    return summary
  }

  /**
   * Generate approval prompt for destructive commands
   */
  generateApprovalPrompt(commandName: string, context: ApprovalContext): ApprovalPrompt {
    return generateApprovalPrompt(commandName, context)
  }

  /**
   * Format plan status for display
   */
  formatStatus(projectId: string): string {
    const plan = this.getActivePlan(projectId)
    if (!plan) return 'No active plan'

    const statusEmoji: Record<string, string> = {
      [PLAN_STATUS.GATHERING]: '🔍',
      [PLAN_STATUS.ANALYZING]: '🧠',
      [PLAN_STATUS.PROPOSING]: '📝',
      [PLAN_STATUS.PENDING_APPROVAL]: '⏳',
      [PLAN_STATUS.APPROVED]: '✅',
      [PLAN_STATUS.EXECUTING]: '⚡',
      [PLAN_STATUS.COMPLETED]: '🎉',
      [PLAN_STATUS.REJECTED]: '❌',
      [PLAN_STATUS.ABORTED]: '🛑',
    }

    const lines = [`${statusEmoji[plan.status] || '📋'} Plan: ${plan.command}`, `Status: ${plan.status}`]

    if (plan.status === PLAN_STATUS.EXECUTING) {
      const progress = Math.round((plan.currentStep / plan.steps.length) * 100)
      lines.push(`Progress: ${plan.currentStep}/${plan.steps.length} (${progress}%)`)
    }

    return lines.join('\n')
  }

  /**
   * Calculate duration between two timestamps
   */
  private _calculateDuration(start: string | null, end: string | null): string | null {
    if (!start || !end) return null
    const ms = new Date(end).getTime() - new Date(start).getTime()
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }
}
