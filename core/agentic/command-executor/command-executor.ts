/**
 * Command Executor Class
 * Orchestrates command execution with agentic delegation.
 */

import path from 'path'
import os from 'os'
import templateLoader from '../template-loader'
import contextBuilder from '../context-builder'
import promptBuilder from '../prompt-builder'
import toolRegistry from '../tool-registry'
import { validate, formatError } from '../validation-rules'
import loopDetector from '../loop-detector'
import chainOfThought from '../chain-of-thought'
import semanticCompression from '../semantic-compression'
import responseTemplates from '../response-templates'
import memorySystem from '../memory-system'
import groundTruth from '../ground-truth'
import thinkBlocks from '../think-blocks'
import parallelTools from '../parallel-tools'
import planMode from '../plan-mode'
import { signalStart, signalEnd } from './status-signal'
import type { ExecutionResult, SimpleExecutionResult, ExecutionToolsFn } from './types'

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

      // 2.5. VALIDATE: Pre-flight checks with specific errors
      const validation = await validate(commandName, metadataContext as unknown as Parameters<typeof validate>[1])
      if (!validation.valid) {
        this.signalEnd()
        return {
          success: false,
          error: formatError(validation),
          validation,
          isValidationError: true,
        }
      }

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
          metadataContext as unknown as Parameters<typeof groundTruth.verify>[1],
          preState
        )

        // Log warnings but don't block (user can override)
        if (!groundTruthResult.verified && groundTruthResult.warnings.length > 0) {
          console.log(groundTruth.formatWarnings(groundTruthResult))
        }
      }

      // 2.7. THINK BLOCKS (P3.1): Dynamic reasoning based on triggers
      let thinkBlock = null
      const preThinkState =
        groundTruthResult?.actual || (await contextBuilder.loadStateForCommand(metadataContext, commandName))
      const thinkTrigger = thinkBlocks.detectTrigger(
        commandName,
        metadataContext as unknown as Parameters<typeof thinkBlocks.detectTrigger>[1],
        preThinkState as Parameters<typeof thinkBlocks.detectTrigger>[2]
      )
      if (thinkTrigger) {
        thinkBlock = await thinkBlocks.generate(
          thinkTrigger,
          commandName,
          metadataContext as unknown as Parameters<typeof thinkBlocks.generate>[2],
          preThinkState as Parameters<typeof thinkBlocks.generate>[3]
        )

        // Log think block if in debug mode
        if (process.env.PRJCT_DEBUG === 'true') {
          console.log(thinkBlocks.format(thinkBlock, true))
        }
      }

      // 2.8. CHAIN OF THOUGHT: Reasoning for critical commands
      let reasoning = null
      if (chainOfThought.requiresReasoning(commandName)) {
        const reasoningState = await contextBuilder.loadStateForCommand(metadataContext, commandName)
        reasoning = await chainOfThought.reason(
          commandName,
          metadataContext as unknown as Parameters<typeof chainOfThought.reason>[1],
          reasoningState as Parameters<typeof chainOfThought.reason>[2]
        )

        // If reasoning shows critical issues, warn but continue
        if (reasoning.reasoning && !reasoning.reasoning.allPassed) {
          console.log('⚠️  Chain of Thought detected issues:')
          console.log(chainOfThought.formatPlan(reasoning))
        }
      }

      // 3. AGENTIC: Claude decides agent assignment via templates
      let context: Record<string, unknown> = metadataContext as unknown as Record<string, unknown>

      // Provide agent info to context so Claude can delegate
      context = {
        ...context,
        agentsPath: path.join(os.homedir(), '.prjct-cli', 'projects', metadataContext.projectId || '', 'agents'),
        agentRoutingPath: path.join(__dirname, '..', '..', '..', 'templates', 'agentic', 'agent-routing.md'),
        agenticDelegation: true,
      }

      // 6. Load state with filtered context
      const rawState = await contextBuilder.loadState(metadataContext)

      // 6.5. SEMANTIC COMPRESSION: Compress state for reduced token usage
      const compressedState: Record<string, unknown> = {}
      for (const [key, content] of Object.entries(rawState)) {
        if (content) {
          const compressed = semanticCompression.compress(content, key)
          compressedState[key] = {
            raw: content,
            summary: compressed.summary,
            compressed,
          }
        } else {
          compressedState[key] = { raw: null, summary: 'Empty', compressed: null }
        }
      }

      // Use compressed summaries for prompt, keep raw for tool execution
      const state = {
        ...rawState,
        _compressed: compressedState,
        _compressionMetrics: semanticCompression.getMetrics(),
      }

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
        context as Parameters<typeof promptBuilder.build>[1],
        state,
        null,
        learnedPatterns,
        thinkBlock,
        relevantMemories,
        planInfo
      )

      // Log agentic mode
      console.log(`🤖 Agentic delegation enabled - Claude will assign agent via Task tool`)

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
        agentsPath: context.agentsPath as string,
        agentRoutingPath: context.agentRoutingPath as string,
        reasoning,
        thinkBlock,
        groundTruth: groundTruthResult,
        compressionMetrics: state._compressionMetrics,
        learnedPatterns,
        relevantMemories,
        formatResponse: (data: unknown) => responseTemplates.format(commandName, data as Parameters<typeof responseTemplates.format>[1]),
        formatThinkBlock: (verbose: boolean) => thinkBlocks.format(thinkBlock, verbose),
        parallel: {
          execute: (toolCalls: unknown[]) => parallelTools.execute(toolCalls as Parameters<typeof parallelTools.execute>[0]),
          readAll: (paths: string[]) => parallelTools.readAll(paths),
          canParallelize: (tools: string[]) => parallelTools.canParallelize(tools),
          getMetrics: () => parallelTools.getMetrics(),
        },
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
          setAnalysis: (analysis: unknown) => planMode.setAnalysis(metadataContext.projectId!, analysis),
          propose: (plan: unknown) =>
            planMode.proposePlan(metadataContext.projectId!, plan as Parameters<typeof planMode.proposePlan>[1]),
          approve: (feedback?: string | null) => planMode.approvePlan(metadataContext.projectId!, feedback),
          reject: (reason?: string | null) => planMode.rejectPlan(metadataContext.projectId!, reason),
          getApprovalPrompt: () =>
            planMode.generateApprovalPrompt(commandName, context as Parameters<typeof planMode.generateApprovalPrompt>[1]),
          startExecution: () => planMode.startExecution(metadataContext.projectId!),
          getNextStep: () => planMode.getNextStep(metadataContext.projectId!),
          completeStep: (result?: unknown) => planMode.completeStep(metadataContext.projectId!, result),
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
