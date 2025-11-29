/**
 * Command Executor
 * WITH MANDATORY AGENT ASSIGNMENT
 * Every task MUST use a specialized agent
 *
 * OPTIMIZATION (P0.2): Explicit Validation
 * - Pre-flight checks before execution
 * - Specific error messages, never generic failures
 * - Actionable suggestions in every error
 *
 * P3.4: Plan Mode + Approval Flow
 * - Separates planning from execution
 * - Requires approval for destructive commands
 *
 * Source: Claude Code, Devin, Augment Code patterns
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const templateLoader = require('./template-loader')
const contextBuilder = require('./context-builder')
const promptBuilder = require('./prompt-builder')
const toolRegistry = require('./tool-registry')
const MandatoryAgentRouter = require('./agent-router')
const ContextFilter = require('./context-filter')
const ContextEstimator = require('../domain/context-estimator')
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

class CommandExecutor {
  constructor() {
    this.agentRouter = new MandatoryAgentRouter()
    this.contextFilter = new ContextFilter()
    this.contextEstimator = null
  }

  /**
   * Signal that a command is running (for status line)
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
   * Execute command with MANDATORY agent assignment
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

      // 3. CRITICAL: Force agent assignment for ALL task-related commands
      const requiresAgent = template.metadata?.['required-agent'] !== false &&
                           (template.metadata?.['required-agent'] === true ||
                            this.isTaskCommand(commandName) ||
                            this.shouldUseAgent(commandName))

      let context = metadataContext
      let assignedAgent = null

      // MANDATORY: Assign specialized agent for task commands
      if (requiresAgent) {
        // 4. Create task object for analysis
        const task = {
          description: params.task || params.description || commandName,
          type: commandName
        }

        // 5. LAZY CONTEXT: Analyze task FIRST, then estimate files needed
        // This avoids reading all files before knowing what we need
        const agentAssignment = await this.agentRouter.executeTask(
          task,
          metadataContext, // Only metadata, no files yet
          projectPath
        )

        assignedAgent = agentAssignment.agent
        const taskAnalysis = agentAssignment.taskAnalysis

        // Validate agent was assigned
        if (!assignedAgent || !assignedAgent.name) {
          throw new Error(
            `CRITICAL: Failed to assign agent for command "${commandName}". ` +
            `System requires ALL task commands to use specialized agents.`
          )
        }

        // 6. PRE-FILTER: Estimate which files are needed BEFORE reading
        if (!this.contextEstimator) {
          this.contextEstimator = new ContextEstimator()
        }

        const estimatedFiles = await this.contextEstimator.estimateFiles(
          taskAnalysis,
          projectPath
        )

        // 7. Build context ONLY with estimated files (lazy loading)
        const filtered = await this.contextFilter.filterForAgent(
          assignedAgent,
          task,
          projectPath,
          {
            ...metadataContext,
            estimatedFiles, // Pre-filtered file list
            fileCount: estimatedFiles.length
          }
        )

        context = {
          ...filtered,
          agent: assignedAgent,
          originalSize: estimatedFiles.length, // Estimated, not actual full size
          filteredSize: filtered.files?.length || 0,
          reduction: filtered.metrics?.reductionPercent || 0,
          lazyLoaded: true // Flag indicating lazy loading was used
        }
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

      // 9. Build prompt with agent assignment, learned patterns, think blocks, memories, AND plan mode
      const planInfo = {
        isPlanning: requiresPlanning || isInPlanningMode,
        requiresApproval: isDestructive && !params.approved,
        active: activePlan,
        allowedTools: planMode.getAllowedTools(
          isInPlanningMode,
          template.frontmatter['allowed-tools'] || []
        )
      }
      const prompt = promptBuilder.build(template, context, state, assignedAgent, learnedPatterns, thinkBlock, relevantMemories, planInfo)

      // 8. Log agent usage
      if (assignedAgent) {
        console.log(`🤖 Task assigned to: ${assignedAgent.name}`)
        console.log(`📉 Context reduced by: ${context.reduction}%`)
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
        assignedAgent,
        contextReduction: context.reduction,
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

  /**
   * Check if command is task-related
   */
  isTaskCommand(commandName) {
    const taskCommands = [
      'work', 'now', 'build', 'feature', 'bug', 'done',
      'task', 'design', 'cleanup', 'fix', 'test'
    ]
    return taskCommands.includes(commandName)
  }

  /**
   * Determine if command should use an agent
   * Expanded list of commands that benefit from agent specialization
   */
  shouldUseAgent(commandName) {
    // Commands that should ALWAYS use agents
    const agentCommands = [
      'work', 'now', 'build', 'feature', 'bug', 'done',
      'task', 'design', 'cleanup', 'fix', 'test',
      'sync', 'analyze' // These analyze/modify code, need specialization
    ]
    return agentCommands.includes(commandName)
  }

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
   * Simple execution for direct tool access
   * Used by legacy commands during migration
   * @param {string} commandName - Command name
   * @param {Function} executionFn - Function that uses tools
   * @param {string} projectPath - Project path
   * @returns {Promise<Object>}
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
