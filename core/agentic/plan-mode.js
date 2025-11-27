/**
 * Plan Mode System
 *
 * P3.4: Plan Mode + Approval Flow
 * Separates planning from execution for better user confidence.
 *
 * Pattern from: Devin AI, Windsurf, Kiro
 *
 * ```
 * // Planning Mode:
 * // 1. Gather information (read-only tools)
 * // 2. Analyze and understand codebase
 * // 3. Ask clarifying questions
 * // 4. Generate plan with <suggest_plan/>
 * // 5. Wait for user approval
 *
 * // Execution Mode:
 * // 1. Execute approved plan
 * // 2. Show progress
 * // 3. User can pause/abort
 * ```
 */

/**
 * Commands that require planning mode
 */
const PLAN_REQUIRED_COMMANDS = [
  'feature',    // New features need planning
  'spec',       // Specs are planning by definition
  'design',     // Architecture needs planning
  'refactor',   // Refactoring needs impact analysis
  'migrate'     // Migrations are high-risk
]

/**
 * Commands that are destructive and need approval
 */
const DESTRUCTIVE_COMMANDS = [
  'ship',       // Commits and pushes
  'cleanup',    // Deletes files/code
  'git',        // Git operations
  'migrate'     // Database/schema changes
]

/**
 * Read-only tools allowed in planning mode
 */
const PLANNING_TOOLS = [
  'Read',
  'Glob',
  'Grep',
  'GetTimestamp',
  'GetDate',
  'GetDateTime'
]

/**
 * Plan status enum
 */
const PLAN_STATUS = {
  GATHERING: 'gathering',       // Collecting information
  ANALYZING: 'analyzing',       // Understanding context
  PROPOSING: 'proposing',       // Generating plan
  PENDING_APPROVAL: 'pending',  // Waiting for user
  APPROVED: 'approved',         // User approved
  REJECTED: 'rejected',         // User rejected
  EXECUTING: 'executing',       // Running the plan
  COMPLETED: 'completed',       // Done
  ABORTED: 'aborted'            // User stopped mid-execution
}

class PlanMode {
  constructor() {
    this.activePlans = new Map() // projectId -> plan state
  }

  /**
   * Check if command requires planning mode
   * @param {string} commandName
   * @returns {boolean}
   */
  requiresPlanning(commandName) {
    return PLAN_REQUIRED_COMMANDS.includes(commandName)
  }

  /**
   * Check if command is destructive and needs approval
   * @param {string} commandName
   * @returns {boolean}
   */
  isDestructive(commandName) {
    return DESTRUCTIVE_COMMANDS.includes(commandName)
  }

  /**
   * Check if tool is allowed in planning mode
   * @param {string} toolName
   * @returns {boolean}
   */
  isToolAllowedInPlanning(toolName) {
    return PLANNING_TOOLS.includes(toolName)
  }

  /**
   * Get allowed tools for current mode
   * @param {boolean} inPlanningMode
   * @param {string[]} templateTools - Tools from template
   * @returns {string[]}
   */
  getAllowedTools(inPlanningMode, templateTools) {
    if (!inPlanningMode) {
      return templateTools
    }
    // In planning mode, only allow read-only tools
    return templateTools.filter(tool => PLANNING_TOOLS.includes(tool))
  }

  /**
   * Start planning mode for a command
   * @param {string} projectId
   * @param {string} commandName
   * @param {Object} params
   * @returns {Object} Plan state
   */
  startPlanning(projectId, commandName, params) {
    const plan = {
      id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      currentStep: 0
    }

    this.activePlans.set(projectId, plan)
    return plan
  }

  /**
   * Get active plan for project
   * @param {string} projectId
   * @returns {Object|null}
   */
  getActivePlan(projectId) {
    return this.activePlans.get(projectId) || null
  }

  /**
   * Check if project is in planning mode
   * @param {string} projectId
   * @returns {boolean}
   */
  isInPlanningMode(projectId) {
    const plan = this.getActivePlan(projectId)
    if (!plan) return false
    return [
      PLAN_STATUS.GATHERING,
      PLAN_STATUS.ANALYZING,
      PLAN_STATUS.PROPOSING,
      PLAN_STATUS.PENDING_APPROVAL
    ].includes(plan.status)
  }

  /**
   * Record gathered information
   * @param {string} projectId
   * @param {Object} info - { type, source, data }
   */
  recordGatheredInfo(projectId, info) {
    const plan = this.getActivePlan(projectId)
    if (!plan) return

    plan.gatheredInfo.push({
      ...info,
      gatheredAt: new Date().toISOString()
    })
  }

  /**
   * Update plan status
   * @param {string} projectId
   * @param {string} status
   */
  updateStatus(projectId, status) {
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
   * @param {string} projectId
   * @param {Object} analysis
   */
  setAnalysis(projectId, analysis) {
    const plan = this.getActivePlan(projectId)
    if (!plan) return

    plan.analysis = analysis
    plan.status = PLAN_STATUS.ANALYZING
  }

  /**
   * Propose a plan for user approval
   * @param {string} projectId
   * @param {Object} proposedPlan
   * @returns {Object} Formatted plan for display
   */
  proposePlan(projectId, proposedPlan) {
    const plan = this.getActivePlan(projectId)
    if (!plan) return null

    plan.proposedPlan = proposedPlan
    plan.status = PLAN_STATUS.PENDING_APPROVAL

    return this.formatPlanForApproval(plan)
  }

  /**
   * Format plan for user approval display
   * @param {Object} plan
   * @returns {Object}
   */
  formatPlanForApproval(plan) {
    const proposed = plan.proposedPlan

    return {
      summary: proposed.summary || `Plan for: ${plan.command}`,
      approach: proposed.approach,
      steps: proposed.steps || [],
      risks: proposed.risks || [],
      alternatives: proposed.alternatives || [],
      estimatedTime: proposed.estimatedTime,
      affectedFiles: proposed.affectedFiles || [],
      requiresConfirmation: true,
      planId: plan.id
    }
  }

  /**
   * User approves the plan
   * @param {string} projectId
   * @param {string} feedback - Optional user feedback
   * @returns {Object} Approved plan ready for execution
   */
  approvePlan(projectId, feedback = null) {
    const plan = this.getActivePlan(projectId)
    if (!plan || plan.status !== PLAN_STATUS.PENDING_APPROVAL) {
      return null
    }

    plan.userFeedback = feedback
    plan.status = PLAN_STATUS.APPROVED
    plan.approvedAt = new Date().toISOString()

    // Convert proposed plan to executable steps
    plan.steps = (plan.proposedPlan.steps || []).map((step, index) => ({
      index,
      description: step.description || step,
      status: 'pending',
      tool: step.tool,
      args: step.args
    }))

    return {
      approved: true,
      planId: plan.id,
      steps: plan.steps,
      message: `Plan approved. ${plan.steps.length} steps to execute.`
    }
  }

  /**
   * User rejects the plan
   * @param {string} projectId
   * @param {string} reason
   * @returns {Object}
   */
  rejectPlan(projectId, reason = null) {
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
      message: 'Plan rejected. No changes made.'
    }
  }

  /**
   * Start executing approved plan
   * @param {string} projectId
   * @returns {Object} First step to execute
   */
  startExecution(projectId) {
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
   * @param {string} projectId
   * @returns {Object|null}
   */
  getNextStep(projectId) {
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
      progress: Math.round((plan.currentStep / plan.steps.length) * 100)
    }
  }

  /**
   * Mark current step as complete
   * @param {string} projectId
   * @param {Object} result - Step execution result
   * @returns {Object} Next step or completion status
   */
  completeStep(projectId, result = {}) {
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
   * @param {string} projectId
   * @param {string} error
   * @returns {Object}
   */
  failStep(projectId, error) {
    const plan = this.getActivePlan(projectId)
    if (!plan) return null

    plan.steps[plan.currentStep].status = 'failed'
    plan.steps[plan.currentStep].error = error

    return {
      failed: true,
      step: plan.currentStep + 1,
      error,
      options: ['retry', 'skip', 'abort']
    }
  }

  /**
   * Complete the plan
   * @param {string} projectId
   * @returns {Object} Completion summary
   */
  completePlan(projectId) {
    const plan = this.getActivePlan(projectId)
    if (!plan) return null

    plan.status = PLAN_STATUS.COMPLETED
    plan.completedAt = new Date().toISOString()

    const summary = {
      planId: plan.id,
      command: plan.command,
      totalSteps: plan.steps.length,
      completedSteps: plan.steps.filter(s => s.status === 'completed').length,
      failedSteps: plan.steps.filter(s => s.status === 'failed').length,
      duration: this._calculateDuration(plan.executionStartedAt, plan.completedAt)
    }

    // Clear active plan
    this.activePlans.delete(projectId)

    return summary
  }

  /**
   * Abort plan execution
   * @param {string} projectId
   * @param {string} reason
   * @returns {Object}
   */
  abortPlan(projectId, reason = 'User requested') {
    const plan = this.getActivePlan(projectId)
    if (!plan) return null

    plan.status = PLAN_STATUS.ABORTED
    plan.completedAt = new Date().toISOString()
    plan.abortReason = reason

    const summary = {
      aborted: true,
      planId: plan.id,
      reason,
      completedSteps: plan.steps.filter(s => s.status === 'completed').length,
      totalSteps: plan.steps.length
    }

    // Clear active plan
    this.activePlans.delete(projectId)

    return summary
  }

  /**
   * Generate approval prompt for destructive commands
   * @param {string} commandName
   * @param {Object} context
   * @returns {Object}
   */
  generateApprovalPrompt(commandName, context) {
    const prompts = {
      ship: {
        title: 'Ship Confirmation',
        message: 'Ready to commit and push changes?',
        details: [
          `Branch: ${context.branch || 'current'}`,
          `Files: ${context.changedFiles?.length || 0} changed`,
          `Commit: "${context.commitMessage || 'No message'}"`
        ],
        options: [
          { key: 'y', label: 'Yes, ship it', action: 'approve' },
          { key: 'n', label: 'No, cancel', action: 'reject' },
          { key: 'e', label: 'Edit message', action: 'edit' }
        ]
      },
      cleanup: {
        title: 'Cleanup Confirmation',
        message: 'This will delete files/code. Continue?',
        details: [
          `Files to delete: ${context.filesToDelete?.length || 0}`,
          `Code to remove: ${context.linesOfCode || 0} lines`
        ],
        options: [
          { key: 'y', label: 'Yes, cleanup', action: 'approve' },
          { key: 'n', label: 'No, cancel', action: 'reject' },
          { key: 'l', label: 'List files first', action: 'list' }
        ]
      },
      git: {
        title: 'Git Operation Confirmation',
        message: `Execute: ${context.operation || 'git operation'}?`,
        details: context.warnings || [],
        options: [
          { key: 'y', label: 'Yes, execute', action: 'approve' },
          { key: 'n', label: 'No, cancel', action: 'reject' }
        ]
      }
    }

    return prompts[commandName] || {
      title: 'Confirmation Required',
      message: `Execute ${commandName}?`,
      options: [
        { key: 'y', label: 'Yes', action: 'approve' },
        { key: 'n', label: 'No', action: 'reject' }
      ]
    }
  }

  /**
   * Format plan status for display
   * @param {string} projectId
   * @returns {string}
   */
  formatStatus(projectId) {
    const plan = this.getActivePlan(projectId)
    if (!plan) return 'No active plan'

    const statusEmoji = {
      [PLAN_STATUS.GATHERING]: '🔍',
      [PLAN_STATUS.ANALYZING]: '🧠',
      [PLAN_STATUS.PROPOSING]: '📝',
      [PLAN_STATUS.PENDING_APPROVAL]: '⏳',
      [PLAN_STATUS.APPROVED]: '✅',
      [PLAN_STATUS.EXECUTING]: '⚡',
      [PLAN_STATUS.COMPLETED]: '🎉',
      [PLAN_STATUS.REJECTED]: '❌',
      [PLAN_STATUS.ABORTED]: '🛑'
    }

    const lines = [
      `${statusEmoji[plan.status] || '📋'} Plan: ${plan.command}`,
      `Status: ${plan.status}`
    ]

    if (plan.status === PLAN_STATUS.EXECUTING) {
      const progress = Math.round((plan.currentStep / plan.steps.length) * 100)
      lines.push(`Progress: ${plan.currentStep}/${plan.steps.length} (${progress}%)`)
    }

    return lines.join('\n')
  }

  /**
   * Calculate duration between two timestamps
   * @private
   */
  _calculateDuration(start, end) {
    if (!start || !end) return null
    const ms = new Date(end) - new Date(start)
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }
}

// Export singleton and constants
module.exports = new PlanMode()
module.exports.PLAN_STATUS = PLAN_STATUS
module.exports.PLAN_REQUIRED_COMMANDS = PLAN_REQUIRED_COMMANDS
module.exports.DESTRUCTIVE_COMMANDS = DESTRUCTIVE_COMMANDS
module.exports.PLANNING_TOOLS = PLANNING_TOOLS
