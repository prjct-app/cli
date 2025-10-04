/**
 * Command Executor
 * Executes commands using templates - Claude decides everything
 * ZERO if/else business logic
 */

const templateLoader = require('./template-loader')
const contextBuilder = require('./context-builder')
const promptBuilder = require('./prompt-builder')
const toolRegistry = require('./tool-registry')

class CommandExecutor {
  /**
   * Execute a command agentically
   * @param {string} commandName - Command name (e.g., 'now', 'done')
   * @param {Object} params - Command parameters
   * @param {string} projectPath - Project path
   * @returns {Promise<Object>} Execution result
   */
  async execute(commandName, params, projectPath) {
    try {
      // 1. Load template
      const template = await templateLoader.load(commandName)

      // 2. Build context
      const context = await contextBuilder.build(projectPath, params)

      // 3. Load current state
      const state = await contextBuilder.loadState(context)

      // 4. Build prompt for Claude
      const prompt = promptBuilder.build(template, context, state)

      // 5. Execute (in real implementation, this would call Claude)
      // For now, we return structured data that Claude can work with
      return {
        success: true,
        template,
        context,
        state,
        prompt,
        // In production: result from Claude's execution
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
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
