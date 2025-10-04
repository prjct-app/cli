/**
 * Tool Registry
 * Maps allowed-tools from templates to actual functions
 * Simple I/O operations - NO business logic, NO if/else
 */

const fs = require('fs').promises
const path = require('path')
const { promisify } = require('util')
const { exec: execCallback } = require('child_process')
const exec = promisify(execCallback)

class ToolRegistry {
  constructor() {
    this.tools = {
      Read: this.read.bind(this),
      Write: this.write.bind(this),
      Bash: this.bash.bind(this),
      Exec: this.bash.bind(this), // Alias
    }
  }

  /**
   * Get tool function by name
   * @param {string} toolName - Tool name (e.g., 'Read', 'Write')
   * @returns {Function}
   */
  get(toolName) {
    const tool = this.tools[toolName]
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`)
    }
    return tool
  }

  /**
   * Check if tool is allowed
   * @param {string} toolName - Tool name
   * @param {string[]} allowedTools - List of allowed tools
   * @returns {boolean}
   */
  isAllowed(toolName, allowedTools) {
    return allowedTools.includes(toolName)
  }

  /**
   * Read file
   * @param {string} filePath - File path
   * @returns {Promise<string>}
   */
  async read(filePath) {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      return null
    }
  }

  /**
   * Write file
   * @param {string} filePath - File path
   * @param {string} content - Content to write
   * @returns {Promise<void>}
   */
  async write(filePath, content) {
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')
  }

  /**
   * Execute bash command
   * @param {string} command - Command to execute
   * @returns {Promise<{stdout: string, stderr: string}>}
   */
  async bash(command) {
    try {
      const { stdout, stderr } = await exec(command)
      return { stdout, stderr }
    } catch (error) {
      return {
        stdout: '',
        stderr: error.message,
        error: true,
      }
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - File path
   * @returns {Promise<boolean>}
   */
  async exists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * List directory
   * @param {string} dirPath - Directory path
   * @returns {Promise<string[]>}
   */
  async list(dirPath) {
    try {
      return await fs.readdir(dirPath)
    } catch {
      return []
    }
  }
}

module.exports = new ToolRegistry()
