/**
 * Command Executor
 * Orchestrates command execution with agentic delegation.
 *
 * @module agentic/command-executor
 * @version 3.4
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import templateLoader from './template-loader'
import contextBuilder from './context-builder'
import promptBuilder from './prompt-builder'
import toolRegistry from './tool-registry'
import loopDetector from './loop-detector'
import chainOfThought from './chain-of-thought'
import memorySystem from './memory-system'
import groundTruth from './ground-truth'
import planMode from './plan-mode'
import templateExecutor from './template-executor'

import type {
  ExecutionResult,
  SimpleExecutionResult,
  ExecutionToolsFn,
  ApprovalContext,
  PromptContext,
} from '../types'

// =============================================================================
// Status Signal
// =============================================================================

const RUNNING_FILE = path.join(os.homedir(), '.prjct-cli', '.running')

/**
 * Signal that a command is running (for status line)
 */
export function signalStart(commandName: string): void {
  try {
    const dir = path.dirname(RUNNING_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(RUNNING_FILE, `/p:${commandName}`)
  } catch (_error) {
    // Silently ignore - status line is optional
  }
}

/**
 * Signal that command has finished (for status line)
 */
export function signalEnd(): void {
  try {
    if (fs.existsSync(RUNNING_FILE)) {
      fs.unlinkSync(RUNNING_FILE)
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
  signalStart(commandName: string): void {
    signalStart(commandName)
  }

  /**
   * Signal that command has finished (for status line)
   */
  signalEnd(): void {
    signalEnd()
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
    this.signalStart(commandName)

    // Context for loop detection
    const loopContext = (params.task as string) || (params.description as string) || ''

    // Check if we're in a loop BEFORE attempting
    if (loopDetector.shouldEscalate(commandName, loopContext)) {
      const escalation = loopDetector.getEscalationInfo(commandName, loopContext)
      this.signalEnd()
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

      // 2.55. P3.4 PLAN MODE: Check if command requires planning
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

      // 2.6. GROUND TRUTH: Verify actual state before critical operations
      let groundTruthResult = null
      if (groundTruth.requiresVerification(commandName)) {
        const preState = await contextBuilder.loadStateForCommand(metadataContext, commandName)
        groundTruthResult = await groundTruth.verify(
          commandName,
          metadataContext,
          preState
        )

        // Log warnings but don't block (user can override)
        if (!groundTruthResult.verified && groundTruthResult.warnings.length > 0) {
          console.log(groundTruth.formatWarnings(groundTruthResult))
        }
      }

      // 2.8. CHAIN OF THOUGHT: Reasoning for critical commands
      let reasoning = null
      if (chainOfThought.requiresReasoning(commandName)) {
        const reasoningState = await contextBuilder.loadStateForCommand(metadataContext, commandName)
        reasoning = await chainOfThought.reason(
          commandName,
          metadataContext,
          reasoningState
        )

        // If reasoning shows critical issues, warn but continue
        if (reasoning.reasoning && !reasoning.reasoning.allPassed) {
          console.log('⚠️  Chain of Thought detected issues:')
          console.log(chainOfThought.formatPlan(reasoning))
        }
      }

      // 3. AGENTIC: Template-first execution
      // Claude decides agent assignment via templates - no hardcoded routing
      const taskDescription = (params.task as string) || (params.description as string) || ''
      const agenticExecContext = await templateExecutor.buildContext(
        commandName,
        taskDescription,
        projectPath
      )
      const agenticInfo = templateExecutor.buildAgenticPrompt(agenticExecContext)

      // Build context with agent routing info for Claude delegation
      const context: PromptContext = {
        ...metadataContext,
        agentsPath: agenticExecContext.paths.agentsDir,
        agentRoutingPath: agenticExecContext.paths.agentRouting,
        orchestratorPath: agenticExecContext.paths.orchestrator,
        taskFragmentationPath: agenticExecContext.paths.taskFragmentation,
        agenticDelegation: true,
        agenticMode: true,
      }

      // 6. Load state with filtered context
      const state = await contextBuilder.loadState(metadataContext)

      // 7. MEMORY: Load learned patterns AND relevant memories for this command
      let learnedPatterns = null
      let relevantMemories = null
      if (metadataContext.projectId) {
        learnedPatterns = {
          commit_footer: await memorySystem.getSmartDecision(metadataContext.projectId, 'commit_footer'),
          branch_naming: await memorySystem.getSmartDecision(metadataContext.projectId, 'branch_naming'),
          test_before_ship: await memorySystem.getSmartDecision(metadataContext.projectId, 'test_before_ship'),
          preferred_agent: await memorySystem.getSmartDecision(
            metadataContext.projectId,
            `preferred_agent_${commandName}`
          ),
        }

        // P3.3: Get relevant memories for context
        relevantMemories = await memorySystem.getRelevantMemories(
          metadataContext.projectId,
          { commandName, params },
          5
        )
      }

      // 9. Build prompt - NO agent assignment here, Claude decides via templates
      const planInfo = {
        isPlanning: requiresPlanning || isInPlanningMode,
        requiresApproval: isDestructive && !params.approved,
        active: activePlan,
        allowedTools: planMode.getAllowedTools(isInPlanningMode, template.frontmatter['allowed-tools'] || []),
      }
      // Agent is null - Claude assigns via Task tool using agent-routing.md
      const prompt = promptBuilder.build(
        template,
        context,
        state,
        null,
        learnedPatterns,
        null,
        relevantMemories,
        planInfo
      )

      // Log agentic mode
      console.log(`🤖 Template-first execution: Claude reads templates and decides`)
      if (agenticInfo.requiresOrchestration) {
        console.log(`   → Orchestration: ${agenticExecContext.paths.orchestrator}`)
      }

      // Record successful attempt
      loopDetector.recordSuccess(commandName, loopContext)

      // Signal end for status line
      this.signalEnd()

      return {
        success: true,
        template,
        context,
        state,
        prompt,
        agenticDelegation: true,
        agenticMode: true,
        agenticExecContext,
        agenticPrompt: agenticInfo.prompt,
        requiresOrchestration: agenticInfo.requiresOrchestration,
        agentsPath: context.agentsPath as string,
        agentRoutingPath: context.agentRoutingPath as string,
        orchestratorPath: agenticExecContext.paths.orchestrator,
        taskFragmentationPath: agenticExecContext.paths.taskFragmentation,
        reasoning,
        groundTruth: groundTruthResult,
        learnedPatterns,
        relevantMemories,
        memory: {
          create: (memory: unknown) =>
            memorySystem.createMemory(metadataContext.projectId!, memory as Parameters<typeof memorySystem.createMemory>[1]),
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
            planMode.recordGatheredInfo(metadataContext.projectId!, info as Parameters<typeof planMode.recordGatheredInfo>[1]),
          setAnalysis: (analysis: unknown) => planMode.setAnalysis(metadataContext.projectId!, analysis as Parameters<typeof planMode.setAnalysis>[1]),
          propose: (plan: unknown) =>
            planMode.proposePlan(metadataContext.projectId!, plan as Parameters<typeof planMode.proposePlan>[1]),
          approve: (feedback?: string | null) => planMode.approvePlan(metadataContext.projectId!, feedback),
          reject: (reason?: string | null) => planMode.rejectPlan(metadataContext.projectId!, reason),
          getApprovalPrompt: () =>
            planMode.generateApprovalPrompt(commandName, {
              // Reason: `context` here is the command execution context, not the plan-mode ApprovalContext.
              // Provide required fields with safe defaults to avoid unsafe casting.
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
          completeStep: (result?: unknown) => planMode.completeStep(metadataContext.projectId!, result as Parameters<typeof planMode.completeStep>[1]),
          failStep: (error: string) => planMode.failStep(metadataContext.projectId!, error),
          abort: (reason?: string) => planMode.abortPlan(metadataContext.projectId!, reason),
          getStatus: () => planMode.formatStatus(metadataContext.projectId!),
          getAllowedTools: () =>
            planMode.getAllowedTools(isInPlanningMode, template.frontmatter['allowed-tools'] || []),
        },
      }
    } catch (error) {
      // Signal end for status line
      this.signalEnd()

      // Record failed attempt for loop detection
      const attemptInfo = loopDetector.recordAttempt(commandName, loopContext, {
        success: false,
        error: (error as Error).message,
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
        error: (error as Error).message,
        attemptNumber: attemptInfo.attemptNumber,
        isLooping: attemptInfo.isLooping,
      }
    }
  }

  /**
   * Execute tool with permission check
   */
  async executeTool(toolName: string, args: unknown[], allowedTools: string[]): Promise<unknown> {
    // Check if tool is allowed
    if (!toolRegistry.isAllowed(toolName, allowedTools)) {
      throw new Error(`Tool ${toolName} not allowed for this command`)
    }

    // Get tool function
    const tool = toolRegistry.get(toolName)
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`)
    }

    // Execute tool
    return await tool(...args)
  }

  /**
   * Simple execution for direct tool access (legacy migration helper)
   */
  async executeSimple(
    commandName: string,
    executionFn: ExecutionToolsFn,
    projectPath: string
  ): Promise<SimpleExecutionResult> {
    try {
      // Load template to get allowed tools
      const template = await templateLoader.load(commandName)
      const allowedTools = template.frontmatter['allowed-tools'] || []

      // Build context
      const context = await contextBuilder.build(projectPath)

      // Create tools proxy that checks permissions
      const tools = {
        read: async (filePath: string) => this.executeTool('Read', [filePath], allowedTools),
        write: async (filePath: string, content: string) => this.executeTool('Write', [filePath, content], allowedTools),
        bash: async (command: string) => this.executeTool('Bash', [command], allowedTools),
      }

      // Execute user function with tools
      const result = await executionFn(tools, context)

      return {
        success: true,
        result,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }
}

// =============================================================================
// Default Export
// =============================================================================

const commandExecutor = new CommandExecutor()
export default commandExecutor
