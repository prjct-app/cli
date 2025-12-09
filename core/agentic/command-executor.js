/**
 * Command Executor
 * Orchestrates command execution with agentic delegation.
 *
 * @module agentic/command-executor
 * @version 3.4
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const templateLoader = require('./template-loader')
const contextBuilder = require('./context-builder')
const promptBuilder = require('./prompt-builder')
const toolRegistry = require('./tool-registry')
// REMOVED: MandatoryAgentRouter, ContextFilter, ContextEstimator
// Agent assignment is 100% agentic - Claude decides via templates
const { validate, formatError } = require('./validation-rules')
const loopDetector = require('./loop-detector')
const chainOfThought = require('./chain-of-thought')
const semanticCompression = require('./semantic-compression')
const responseTemplates = require('./response-templates')
const memorySystem = require('./memory-system')
const groundTruth = require('./ground-truth')
const thinkBlocks = require('./think-blocks')
const parallelTools = require('./parallel-tools')
const planMode = require('./plan-mode')

// Running file for status line integration
const RUNNING_FILE = path.join(os.homedir(), '.prjct-cli', '.running')
// P3.5, P3.6, P3.7: DELEGATED TO CLAUDE CODE
// - semantic-search → Claude Code has Grep/Glob with semantic understanding
// - code-intelligence → Claude Code has native LSP integration
// - browser-preview → Claude Code can use Bash directly

/**
 * Orchestrates prjct command execution.
 * Handles template loading, context building, validation, and agentic delegation.
 */
class CommandExecutor {
  constructor() {}

  /**
   * Signal that a command is running (for status line)
   *
   * @param {string} commandName - Name of the running command
   */
  signalStart(commandName) {
    try {
      const dir = path.dirname(RUNNING_FILE)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(RUNNING_FILE, `/p:${commandName}`)
    } catch {
      // Silently ignore - status line is optional
    }
  }

  /**
   * Signal that command has finished (for status line)
   */
  signalEnd() {
    try {
      if (fs.existsSync(RUNNING_FILE)) {
        fs.unlinkSync(RUNNING_FILE)
      }
    } catch {
      // Silently ignore - status line is optional
    }
  }

  /**
   * Execute a prjct command with full agentic delegation
   *
   * @param {string} commandName - Command to execute (e.g., 'now', 'ship')
   * @param {Object} params - Command parameters
   * @param {string} projectPath - Path to the project
   * @returns {Promise<Object>} Execution result with prompt, context, helpers
   */
  async execute(commandName, params, projectPath) {
    // Signal start for status line
    this.signalStart(commandName)

    // Context for loop detection
    const loopContext = params.task || params.description || ''

    // Check if we're in a loop BEFORE attempting
    if (loopDetector.shouldEscalate(commandName, loopContext)) {
      const escalation = loopDetector.getEscalationInfo(commandName, loopContext)
      this.signalEnd()
      return {
        success: false,
        error: escalation.message,
        escalation,
        isLoopDetected: true,
        suggestion: escalation.suggestion
      }
    }

    try {
      // 1. Load template
      const template = await templateLoader.load(commandName)

      // 2. Build METADATA context only (lazy loading - no file reads yet)
      const metadataContext = await contextBuilder.build(projectPath, params)

      // 2.5. VALIDATE: Pre-flight checks with specific errors
      const validation = await validate(commandName, metadataContext)
      if (!validation.valid) {
        this.signalEnd()
        return {
          success: false,
          error: formatError(validation),
          validation,
          isValidationError: true
        }
      }

      // 2.55. P3.4 PLAN MODE: Check if command requires planning
      const requiresPlanning = planMode.requiresPlanning(commandName)
      const isDestructive = planMode.isDestructive(commandName)
      const isInPlanningMode = planMode.isInPlanningMode(metadataContext.projectId)

      // Start planning mode if required and not already in it
      let activePlan = null
      if (requiresPlanning && !isInPlanningMode && !params.skipPlanning) {
        activePlan = planMode.startPlanning(metadataContext.projectId, commandName, params)
      } else if (isInPlanningMode) {
        activePlan = planMode.getActivePlan(metadataContext.projectId)
      }

      // 2.6. GROUND TRUTH: Verify actual state before critical operations
      let groundTruthResult = null
      if (groundTruth.requiresVerification(commandName)) {
        const preState = await contextBuilder.loadStateForCommand(metadataContext, commandName)
        groundTruthResult = await groundTruth.verify(commandName, metadataContext, preState)

        // Log warnings but don't block (user can override)
        if (!groundTruthResult.verified && groundTruthResult.warnings.length > 0) {
          console.log(groundTruth.formatWarnings(groundTruthResult))
        }
      }

      // 2.7. THINK BLOCKS (P3.1): Dynamic reasoning based on triggers
      // ANTI-HALLUCINATION FIX: Load state BEFORE using it (was undefined)
      let thinkBlock = null
      const preThinkState = groundTruthResult?.actual || await contextBuilder.loadStateForCommand(metadataContext, commandName)
      const thinkTrigger = thinkBlocks.detectTrigger(commandName, metadataContext, preThinkState)
      if (thinkTrigger) {
        thinkBlock = await thinkBlocks.generate(thinkTrigger, commandName, metadataContext, preThinkState)

        // Log think block if in debug mode
        if (process.env.PRJCT_DEBUG === 'true') {
          console.log(thinkBlocks.format(thinkBlock, true))
        }
      }

      // 2.8. CHAIN OF THOUGHT: Reasoning for critical commands
      let reasoning = null
      if (chainOfThought.requiresReasoning(commandName)) {
        // Load state for reasoning
        const reasoningState = await contextBuilder.loadStateForCommand(metadataContext, commandName)
        reasoning = await chainOfThought.reason(commandName, metadataContext, reasoningState)

        // If reasoning shows critical issues, warn but continue
        if (reasoning.reasoning && !reasoning.reasoning.allPassed) {
          console.log('⚠️  Chain of Thought detected issues:')
          console.log(chainOfThought.formatPlan(reasoning))
        }
      }

      // 3. AGENTIC: Claude decides agent assignment via templates
      // NO if/else logic here - templates instruct Claude to use Task tool
      // See templates/agentic/agent-routing.md for routing rules
      let context = metadataContext

      // Provide agent info to context so Claude can delegate
      context = {
        ...context,
        agentsPath: path.join(os.homedir(), '.prjct-cli', 'projects', metadataContext.projectId || '', 'agents'),
        agentRoutingPath: path.join(__dirname, '..', '..', 'templates', 'agentic', 'agent-routing.md'),
        // Flag: Claude must delegate to subagent via Task tool
        agenticDelegation: true
      }

      // 6. Load state with filtered context
      const rawState = await contextBuilder.loadState(context)

      // 6.5. SEMANTIC COMPRESSION: Compress state for reduced token usage
      const compressedState = {}
      for (const [key, content] of Object.entries(rawState)) {
        if (content) {
          const compressed = semanticCompression.compress(content, key)
          compressedState[key] = {
            raw: content,
            summary: compressed.summary,
            compressed
          }
        } else {
          compressedState[key] = { raw: null, summary: 'Empty', compressed: null }
        }
      }

      // Use compressed summaries for prompt, keep raw for tool execution
      const state = {
        ...rawState,
        _compressed: compressedState,
        _compressionMetrics: semanticCompression.getMetrics()
      }

      // 7. MEMORY: Load learned patterns AND relevant memories for this command
      let learnedPatterns = null
      let relevantMemories = null
      if (context.projectId) {
        learnedPatterns = {
          commit_footer: await memorySystem.getSmartDecision(context.projectId, 'commit_footer'),
          branch_naming: await memorySystem.getSmartDecision(context.projectId, 'branch_naming'),
          test_before_ship: await memorySystem.getSmartDecision(context.projectId, 'test_before_ship'),
          preferred_agent: await memorySystem.getSmartDecision(context.projectId, `preferred_agent_${commandName}`)
        }

        // P3.3: Get relevant memories for context
        relevantMemories = await memorySystem.getRelevantMemories(
          context.projectId,
          { commandName, params },
          5 // Top 5 relevant memories
        )
      }

      // 9. Build prompt - NO agent assignment here, Claude decides via templates
      const planInfo = {
        isPlanning: requiresPlanning || isInPlanningMode,
        requiresApproval: isDestructive && !params.approved,
        active: activePlan,
        allowedTools: planMode.getAllowedTools(
          isInPlanningMode,
          template.frontmatter['allowed-tools'] || []
        )
      }
      // Agent is null - Claude assigns via Task tool using agent-routing.md
      const prompt = promptBuilder.build(template, context, state, null, learnedPatterns, thinkBlock, relevantMemories, planInfo)

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
        // AGENTIC: No pre-assigned agent - Claude delegates via Task tool
        agenticDelegation: true,
        agentsPath: context.agentsPath,
        agentRoutingPath: context.agentRoutingPath,
        reasoning, // Chain of thought results
        thinkBlock, // Think blocks (P3.1)
        groundTruth: groundTruthResult, // Ground truth verification (P1.3)
        compressionMetrics: state._compressionMetrics,
        learnedPatterns, // Memory system patterns
        relevantMemories, // P3.3: Semantic memories
        // Response formatter helper
        formatResponse: (data) => responseTemplates.format(commandName, data),
        // Think block formatter helper
        formatThinkBlock: (verbose) => thinkBlocks.format(thinkBlock, verbose),
        // P3.2: Parallel tools helper
        parallel: {
          execute: (toolCalls) => parallelTools.execute(toolCalls),
          readAll: (paths) => parallelTools.readAll(paths),
          canParallelize: (tools) => parallelTools.canParallelize(tools),
          getMetrics: () => parallelTools.getMetrics()
        },
        // P3.3: Memory system helpers
        memory: {
          create: (memory) => memorySystem.createMemory(context.projectId, memory),
          autoRemember: (type, value, ctx) => memorySystem.autoRemember(context.projectId, type, value, ctx),
          search: (query) => memorySystem.searchMemories(context.projectId, query),
          findByTags: (tags) => memorySystem.findByTags(context.projectId, tags),
          getStats: () => memorySystem.getMemoryStats(context.projectId)
        },
        // P3.4: Plan Mode helpers
        plan: {
          active: activePlan,
          isPlanning: requiresPlanning || isInPlanningMode,
          isDestructive,
          requiresApproval: isDestructive && !params.approved,
          // Planning phase methods
          recordInfo: (info) => planMode.recordGatheredInfo(context.projectId, info),
          setAnalysis: (analysis) => planMode.setAnalysis(context.projectId, analysis),
          propose: (plan) => planMode.proposePlan(context.projectId, plan),
          // Approval methods
          approve: (feedback) => planMode.approvePlan(context.projectId, feedback),
          reject: (reason) => planMode.rejectPlan(context.projectId, reason),
          getApprovalPrompt: () => planMode.generateApprovalPrompt(commandName, context),
          // Execution methods
          startExecution: () => planMode.startExecution(context.projectId),
          getNextStep: () => planMode.getNextStep(context.projectId),
          completeStep: (result) => planMode.completeStep(context.projectId, result),
          failStep: (error) => planMode.failStep(context.projectId, error),
          abort: (reason) => planMode.abortPlan(context.projectId, reason),
          // Status
          getStatus: () => planMode.formatStatus(context.projectId),
          getAllowedTools: () => planMode.getAllowedTools(
            isInPlanningMode,
            template.frontmatter['allowed-tools'] || []
          )
        }
        // P3.5, P3.6: DELEGATED TO CLAUDE CODE
        // Use Claude Code's native tools instead:
        // - Grep for semantic search
        // - Glob for file patterns
        // - Native LSP for code intelligence
      }
    } catch (error) {
      // Signal end for status line
      this.signalEnd()

      // Record failed attempt for loop detection
      const attemptInfo = loopDetector.recordAttempt(commandName, loopContext, {
        success: false,
        error: error.message
      })

      // Check if we should escalate after this failure
      if (attemptInfo.shouldEscalate) {
        const escalation = loopDetector.getEscalationInfo(commandName, loopContext)
        return {
          success: false,
          error: escalation.message,
          escalation,
          isLoopDetected: true,
          suggestion: escalation.suggestion
        }
      }

      return {
        success: false,
        error: error.message,
        attemptNumber: attemptInfo.attemptNumber,
        isLooping: attemptInfo.isLooping
      }
    }
  }

  // REMOVED: isTaskCommand() and shouldUseAgent()
  // Agent assignment is now 100% agentic - Claude decides via templates
  // See templates/agentic/agent-routing.md

  /**
   * Execute tool with permission check
   * @param {string} toolName - Tool name
   * @param {Array} args - Tool arguments
   * @param {string[]} allowedTools - Allowed tools for this command
   * @returns {Promise<any>}
   */
  async executeTool(toolName, args, allowedTools) {
    // Check if tool is allowed
    if (!toolRegistry.isAllowed(toolName, allowedTools)) {
      throw new Error(`Tool ${toolName} not allowed for this command`)
    }

    // Get tool function
    const tool = toolRegistry.get(toolName)

    // Execute tool
    return await tool(...args)
  }

  /**
   * Simple execution for direct tool access (legacy migration helper)
   *
   * @param {string} commandName - Command name
   * @param {Function} executionFn - Function receiving (tools, context)
   * @param {string} projectPath - Project path
   * @returns {Promise<Object>} Result with success flag
   */
  async executeSimple(commandName, executionFn, projectPath) {
    try {
      // Load template to get allowed tools
      const template = await templateLoader.load(commandName)
      const allowedTools = template.frontmatter['allowed-tools'] || []

      // Build context
      const context = await contextBuilder.build(projectPath)

      // Create tools proxy that checks permissions
      const tools = {
        read: async (filePath) => this.executeTool('Read', [filePath], allowedTools),
        write: async (filePath, content) =>
          this.executeTool('Write', [filePath, content], allowedTools),
        bash: async (command) => this.executeTool('Bash', [command], allowedTools),
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
        error: error.message,
      }
    }
  }
}

module.exports = new CommandExecutor()
