/**
 * Agent Router
 * Orchestrates agent loading and context building for Claude delegation.
 *
 * @module agentic/agent-router
 * @version 2.0.0
 */

const fs = require('fs').promises
const path = require('path')
const configManager = require('../infrastructure/config-manager')
const pathManager = require('../infrastructure/path-manager')

/**
 * Routes tasks to specialized agents based on Claude's decisions.
 * Handles agent loading, context building, and usage logging.
 */
class AgentRouter {
  constructor() {
    /** @type {string|null} */
    this.projectId = null
    /** @type {string|null} */
    this.agentsPath = null
  }

  /**
   * Initialize router with project context
   *
   * @param {string} projectPath - Path to the project
   */
  async initialize(projectPath) {
    this.projectId = await configManager.getProjectId(projectPath)
    this.agentsPath = pathManager.getPath(this.projectId, 'agents')
  }

  /**
   * Load all available agents from project
   *
   * @returns {Promise<Array<{name: string, content: string}>>} Available agents
   */
  async loadAvailableAgents() {
    try {
      const files = await fs.readdir(this.agentsPath)
      const agents = []

      for (const file of files) {
        if (file.endsWith('.md')) {
          const name = file.replace('.md', '')
          const content = await fs.readFile(
            path.join(this.agentsPath, file),
            'utf-8'
          )
          agents.push({ name, content })
        }
      }

      return agents
    } catch {
      return []
    }
  }

  /**
   * Get list of available agent names
   *
   * @returns {Promise<string[]>} Agent names
   */
  async getAgentNames() {
    const agents = await this.loadAvailableAgents()
    return agents.map(a => a.name)
  }

  /**
   * Load a specific agent by name
   *
   * @param {string} name - Agent name (without .md extension)
   * @returns {Promise<{name: string, content: string}|null>} Agent or null
   */
  async loadAgent(name) {
    try {
      const filePath = path.join(this.agentsPath, `${name}.md`)
      const content = await fs.readFile(filePath, 'utf-8')
      return { name, content }
    } catch {
      return null
    }
  }

  /**
   * Build context for Claude to decide agent assignment
   *
   * @param {string|Object} task - Task description or object
   * @param {string} projectPath - Project path
   * @returns {Promise<Object>} Assignment context for Claude
   */
  async buildAssignmentContext(task, projectPath) {
    const agents = await this.getAgentNames()

    return {
      task: task.description || task,
      availableAgents: agents,
      projectPath,
      projectId: this.projectId,
      // Claude reads this and decides via template
      _template: 'templates/agent-assignment.md'
    }
  }

  /**
   * Log agent usage to JSONL file
   *
   * @param {string|Object} task - Task description
   * @param {string|Object} agent - Agent used
   * @param {string} projectPath - Project path (unused, kept for API compat)
   */
  async logUsage(task, agent, projectPath) {
    try {
      const logPath = path.join(
        process.env.HOME,
        '.prjct-cli',
        'projects',
        this.projectId,
        'agent-usage.jsonl'
      )

      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        task: typeof task === 'string' ? task : task.description,
        agent: agent.name || agent,
        projectId: this.projectId
      }) + '\n'

      await fs.appendFile(logPath, entry)
    } catch {
      // Silent fail for logging
    }
  }
}

module.exports = AgentRouter
