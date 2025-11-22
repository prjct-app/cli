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

class CommandExecutor {
  constructor() {
    this.agentRouter = new MandatoryAgentRouter()
    this.contextFilter = new ContextFilter()
  }

  /**
   * Execute command with MANDATORY agent assignment
   */
  async execute(commandName, params, projectPath) {
    try {
      // 1. Load template
      const template = await templateLoader.load(commandName)

      // 2. Build FULL context (before filtering)
      const fullContext = await contextBuilder.build(projectPath, params)

      // 3. Check if command requires agent
      const requiresAgent = template.metadata?.['required-agent'] ||
                           this.isTaskCommand(commandName)

      let context = fullContext
      let assignedAgent = null

      if (requiresAgent) {
        // 4. MANDATORY: Assign specialized agent
        const task = {
          description: params.task || params.description || commandName,
          type: commandName
        }

        const agentAssignment = await this.agentRouter.executeTask(
          task,
          fullContext,
          projectPath
        )

        assignedAgent = agentAssignment.agent

        // 5. Filter context for this specific agent (70-90% reduction)
        const filtered = await this.contextFilter.filterForAgent(
          assignedAgent,
          task,
          projectPath,
          fullContext
        )

        context = {
          ...filtered,
          agent: assignedAgent,
          originalSize: fullContext.files?.length || 0,
          filteredSize: filtered.files?.length || 0,
          reduction: filtered.metrics?.reductionPercent || 0
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
    const taskCommands = ['work', 'now', 'build', 'feature', 'bug', 'done']
    return taskCommands.includes(commandName)
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
