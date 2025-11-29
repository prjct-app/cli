/**
 * Agent Router - Orchestration Only
 *
 * AGENTIC: All decisions made by Claude via templates/agent-assignment.md
 * JS only orchestrates: load agents, build context, delegate to Claude
 *
 * NO scoring logic, NO matching algorithms, NO hardcoded mappings
 *
 * @version 2.0.0
 */

const fs = require('fs').promises
const path = require('path')
const configManager = require('../infrastructure/config-manager')
const pathManager = require('../infrastructure/path-manager')

class AgentRouter {
  constructor() {
    this.projectId = null
    this.agentsPath = null
  }

  /**
   * Initialize with project context
   * ORCHESTRATION: Just sets up paths
   */
  async initialize(projectPath) {
    this.projectId = await configManager.getProjectId(projectPath)
    this.agentsPath = pathManager.getPath(this.projectId, 'agents')
  }

  /**
   * Load all available agents from project
   * ORCHESTRATION: File I/O only, no logic
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
   * Get agent names list
   * ORCHESTRATION: Simple extraction
   */
  async getAgentNames() {
    const agents = await this.loadAvailableAgents()
    return agents.map(a => a.name)
  }

  /**
   * Load specific agent by name
   * ORCHESTRATION: File I/O only
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
   * Build context for agent assignment
   * ORCHESTRATION: Data gathering only
   *
   * Claude uses this context + templates/agent-assignment.md to decide
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
   * Log agent usage
   * ORCHESTRATION: File I/O only
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
