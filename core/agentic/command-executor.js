/**
 * Command Executor
 * WITH MANDATORY AGENT ASSIGNMENT
 * Every task MUST use a specialized agent
 */

const templateLoader = require('./template-loader')
const contextBuilder = require('./context-builder')
const promptBuilder = require('./prompt-builder')
const toolRegistry = require('./tool-registry')
const MandatoryAgentRouter = require('./agent-router')
const ContextFilter = require('./context-filter')
const ContextEstimator = require('../domain/context-estimator')

class CommandExecutor {
  constructor() {
    this.agentRouter = new MandatoryAgentRouter()
    this.contextFilter = new ContextFilter()
    this.contextEstimator = null
  }

  /**
   * Execute command with MANDATORY agent assignment
   */
  async execute(commandName, params, projectPath) {
    try {
      // 1. Load template
      const template = await templateLoader.load(commandName)

      // 2. Build METADATA context only (lazy loading - no file reads yet)
      const metadataContext = await contextBuilder.build(projectPath, params)

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
      const state = await contextBuilder.loadState(context)

      // 7. Build prompt with agent assignment
      const prompt = promptBuilder.build(template, context, state, assignedAgent)

      // 8. Log agent usage
      if (assignedAgent) {
        console.log(`🤖 Task assigned to: ${assignedAgent.name}`)
        console.log(`📉 Context reduced by: ${context.reduction}%`)
      }

      return {
        success: true,
        template,
        context,
        state,
        prompt,
        assignedAgent,
        contextReduction: context.reduction
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
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
