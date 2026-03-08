/**
 * Command Executor
 * Orchestrates command execution with agentic delegation.
 *
 * @module agentic/command-executor
 * @version 4.0
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ORCHESTRATED_COMMANDS, SIMPLE_COMMANDS } from '../constants/commands'
import type {
  ApprovalContext,
  ExecutionResult,
  OrchestratorContext,
  PromptContext,
} from '../types/agentic'
import { getErrorMessage } from '../types/fs'
import type { SubtaskDisplay } from '../types/utils'
import { agentStream } from '../utils/agent-stream'
import { fileExists } from '../utils/file-helper'
import { printSubtaskProgress } from '../utils/subtask-table'
import contextBuilder from './context-builder'
import loopDetector from './loop-detector'
import memorySystem from './memory-system'
import orchestratorExecutor from './orchestrator-executor'
import planMode from './plan-mode'
import promptBuilder from './prompt-builder'
import templateLoader from './template-loader'

// =============================================================================
// Status Signal
// =============================================================================

function getRunningFilePath(): string {
  const base = process.env.PRJCT_CLI_HOME?.trim() || path.join(os.homedir(), '.prjct-cli')
  return path.join(base, '.running')
}

/**
 * Signal that a command is running (for status line)
 */
export async function signalStart(commandName: string): Promise<void> {
  try {
    const runningFile = getRunningFilePath()
    const dir = path.dirname(runningFile)
    if (!(await fileExists(dir))) {
      await fs.mkdir(dir, { recursive: true })
    }
    await fs.writeFile(runningFile, `/p:${commandName}`)
  } catch (_error) {
    // Silently ignore - status line is optional
  }
}

/**
 * Signal that command has finished (for status line)
 */
export async function signalEnd(): Promise<void> {
  try {
    const runningFile = getRunningFilePath()
    if (await fileExists(runningFile)) {
      await fs.unlink(runningFile)
    }
  } catch (_error) {
    // Silently ignore - status line is optional
  }
}

// =============================================================================
// Command Executor Class
// =============================================================================

export class CommandExecutor {
  /**
   * Signal that a command is running (for status line)
   */
  async signalStart(commandName: string): Promise<void> {
    await signalStart(commandName)
  }

  /**
   * Signal that command has finished (for status line)
   */
  async signalEnd(): Promise<void> {
    await signalEnd()
  }

  /**
   * Check if a command requires orchestration
   */
  private requiresOrchestration(command: string): boolean {
    if (ORCHESTRATED_COMMANDS.includes(command)) return true
    if (SIMPLE_COMMANDS.includes(command)) return false
    return true
  }

  /**
   * Execute a prjct command with full agentic delegation
   */
  async execute(
    commandName: string,
    params: Record<string, unknown>,
    projectPath: string
  ): Promise<ExecutionResult> {
    // Signal start for status line
    await this.signalStart(commandName)

    // Context for loop detection
    const loopContext = (params.task as string) || (params.description as string) || ''

    // Check if we're in a loop BEFORE attempting
    if (loopDetector.shouldEscalate(commandName, loopContext)) {
      const escalation = loopDetector.getEscalationInfo(commandName, loopContext)
      await this.signalEnd()
      return {
        success: false,
        error: escalation?.message,
        escalation,
        isLoopDetected: true,
        suggestion: escalation?.suggestion,
      }
    }

    try {
      // 1. Load template
      const template = await templateLoader.load(commandName)

      // 2. Build METADATA context only (lazy loading - no file reads yet)
      const metadataContext = await contextBuilder.build(projectPath, params)

      // 2.5. PLAN MODE: Check if command requires planning
      const requiresPlanning = planMode.requiresPlanning(commandName)
      const isDestructive = planMode.isDestructive(commandName)
      const isInPlanningMode = planMode.isInPlanningMode(metadataContext.projectId!)

      // Start planning mode if required and not already in it
      let activePlan = null
      if (requiresPlanning && !isInPlanningMode && !params.skipPlanning) {
        activePlan = planMode.startPlanning(metadataContext.projectId!, commandName, params)
      } else if (isInPlanningMode) {
        activePlan = planMode.getActivePlan(metadataContext.projectId!)
      }

      // 3. ORCHESTRATOR: Execute orchestration for commands that require it
      const taskDescription = (params.task as string) || (params.description as string) || ''
      let orchestratorContext: OrchestratorContext | null = null
      if (this.requiresOrchestration(commandName) && taskDescription) {
        try {
          orchestratorContext = await orchestratorExecutor.execute(
            commandName,
            taskDescription,
            projectPath
          )

          // Show orchestration with agent stream
          if (orchestratorContext.detectedDomains.length > 0) {
            agentStream.orchestrate(orchestratorContext.detectedDomains)
          }

          // Show subtasks if fragmented
          if (orchestratorContext.requiresFragmentation && orchestratorContext.subtasks) {
            const subtaskDisplay: SubtaskDisplay[] = orchestratorContext.subtasks.map((s) => ({
              id: s.id,
              domain: s.domain,
              description: s.description,
              status: s.status,
            }))
            printSubtaskProgress(subtaskDisplay)
          }
        } catch (error) {
          // Orchestration failed - log warning but continue without it
          console.warn(`⚠️  Orchestrator warning: ${getErrorMessage(error)}`)
        }
      }

      // Build context
      const context: PromptContext = {
        ...metadataContext,
        agenticDelegation: true,
        agenticMode: true,
      }

      // 4. Load state with filtered context
      const state = await contextBuilder.loadState(metadataContext)

      // 5. MEMORY: Load learned patterns AND relevant memories for this command
      let learnedPatterns = null
      let relevantMemories = null
      if (metadataContext.projectId) {
        learnedPatterns = {
          commit_footer: await memorySystem.getSmartDecision(
            metadataContext.projectId,
            'commit_footer'
          ),
          branch_naming: await memorySystem.getSmartDecision(
            metadataContext.projectId,
            'branch_naming'
          ),
          test_before_ship: await memorySystem.getSmartDecision(
            metadataContext.projectId,
            'test_before_ship'
          ),
          preferred_agent: await memorySystem.getSmartDecision(
            metadataContext.projectId,
            `preferred_agent_${commandName}`
          ),
        }

        // Get relevant memories for context
        relevantMemories = await memorySystem.getRelevantMemories(
          metadataContext.projectId,
          { commandName, params },
          5
        )
      }

      // 6. Build prompt
      const planInfo = {
        isPlanning: requiresPlanning || isInPlanningMode,
        requiresApproval: isDestructive && !params.approved,
        active: activePlan,
        allowedTools: planMode.getAllowedTools(
          isInPlanningMode,
          template.frontmatter['allowed-tools'] || []
        ),
      }
      const aiProvider = require('../infrastructure/ai-provider')
      const activeProvider = await aiProvider.getActiveProvider()
      const isClaudeProvider = activeProvider.name === 'claude'

      const prompt = await promptBuilder.build(
        template,
        context,
        state,
        null,
        learnedPatterns,
        null,
        relevantMemories,
        planInfo,
        orchestratorContext,
        { skipNativeContext: isClaudeProvider }
      )

      // Log agentic mode
      console.log(`🤖 Template-first execution: Claude reads templates and decides`)

      // Record successful attempt
      loopDetector.recordSuccess(commandName, loopContext)

      // Signal end for status line
      await this.signalEnd()

      return {
        success: true,
        template,
        context,
        state,
        prompt,
        agenticDelegation: true,
        agenticMode: true,
        learnedPatterns,
        relevantMemories,
        orchestratorContext,
        memory: {
          create: (memory: unknown) =>
            memorySystem.createMemory(
              metadataContext.projectId!,
              memory as Parameters<typeof memorySystem.createMemory>[1]
            ),
          autoRemember: (type: string, value: string, ctx?: string) =>
            memorySystem.autoRemember(metadataContext.projectId!, type, value, ctx),
          search: (query: string) => memorySystem.searchMemories(metadataContext.projectId!, query),
          findByTags: (tags: string[]) => memorySystem.findByTags(metadataContext.projectId!, tags),
          getStats: () => memorySystem.getMemoryStats(metadataContext.projectId!),
        },
        plan: {
          active: activePlan,
          isPlanning: requiresPlanning || isInPlanningMode,
          isDestructive,
          requiresApproval: isDestructive && !params.approved,
          recordInfo: (info: unknown) =>
            planMode.recordGatheredInfo(
              metadataContext.projectId!,
              info as Parameters<typeof planMode.recordGatheredInfo>[1]
            ),
          setAnalysis: (analysis: unknown) =>
            planMode.setAnalysis(
              metadataContext.projectId!,
              analysis as Parameters<typeof planMode.setAnalysis>[1]
            ),
          propose: (plan: unknown) =>
            planMode.proposePlan(
              metadataContext.projectId!,
              plan as Parameters<typeof planMode.proposePlan>[1]
            ),
          approve: (feedback?: string | null) =>
            planMode.approvePlan(metadataContext.projectId!, feedback),
          reject: (reason?: string | null) =>
            planMode.rejectPlan(metadataContext.projectId!, reason),
          getApprovalPrompt: () =>
            planMode.generateApprovalPrompt(commandName, {
              changedFiles: [],
              filesToDelete: [],
              operation: ((): ApprovalContext['operation'] => {
                if (commandName === 'ship') return 'git_push'
                if (commandName === 'cleanup') return 'delete_files'
                return 'run_command'
              })(),
              warnings: [],
            } satisfies ApprovalContext),
          startExecution: () => planMode.startExecution(metadataContext.projectId!),
          getNextStep: () => planMode.getNextStep(metadataContext.projectId!),
          completeStep: (result?: unknown) =>
            planMode.completeStep(
              metadataContext.projectId!,
              result as Parameters<typeof planMode.completeStep>[1]
            ),
          failStep: (error: string) => planMode.failStep(metadataContext.projectId!, error),
          abort: (reason?: string) => planMode.abortPlan(metadataContext.projectId!, reason),
          getStatus: () => planMode.formatStatus(metadataContext.projectId!),
          getAllowedTools: () =>
            planMode.getAllowedTools(isInPlanningMode, template.frontmatter['allowed-tools'] || []),
        },
      }
    } catch (error) {
      // Signal end for status line
      await this.signalEnd()

      // Record failed attempt for loop detection
      const attemptInfo = loopDetector.recordAttempt(commandName, loopContext, {
        success: false,
        error: getErrorMessage(error),
      })

      // Check if we should escalate after this failure
      if (attemptInfo.shouldEscalate) {
        const escalation = loopDetector.getEscalationInfo(commandName, loopContext)
        return {
          success: false,
          error: escalation?.message,
          escalation,
          isLoopDetected: true,
          suggestion: escalation?.suggestion,
        }
      }

      return {
        success: false,
        error: getErrorMessage(error),
        attemptNumber: attemptInfo.attemptNumber,
        isLooping: attemptInfo.isLooping,
      }
    }
  }
}

// =============================================================================
// Default Export
// =============================================================================

const commandExecutor = new CommandExecutor()
export default commandExecutor
