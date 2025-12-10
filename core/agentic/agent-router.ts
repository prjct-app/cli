/**
 * Agent Router
 * Orchestrates agent loading and context building for Claude delegation.
 *
 * @module agentic/agent-router
 * @version 2.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'

interface Agent {
  name: string
  content: string
}

interface AssignmentContext {
  task: string
  availableAgents: string[]
  projectPath: string
  projectId: string | null
  _template: string
}

/**
 * Routes tasks to specialized agents based on Claude's decisions.
 * Handles agent loading, context building, and usage logging.
 */
class AgentRouter {
  projectId: string | null = null
  agentsPath: string | null = null

  /**
   * Initialize router with project context
   */
  async initialize(projectPath: string): Promise<void> {
    this.projectId = await configManager.getProjectId(projectPath)
    this.agentsPath = pathManager.getPath(this.projectId!, 'agents')
  }

  /**
   * Load all available agents from project
   */
  async loadAvailableAgents(): Promise<Agent[]> {
    try {
      const files = await fs.readdir(this.agentsPath!)
      const agents: Agent[] = []

      for (const file of files) {
        if (file.endsWith('.md')) {
          const name = file.replace('.md', '')
          const content = await fs.readFile(path.join(this.agentsPath!, file), 'utf-8')
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
   */
  async getAgentNames(): Promise<string[]> {
    const agents = await this.loadAvailableAgents()
    return agents.map((a) => a.name)
  }

  /**
   * Load a specific agent by name
   */
  async loadAgent(name: string): Promise<Agent | null> {
    try {
      const filePath = path.join(this.agentsPath!, `${name}.md`)
      const content = await fs.readFile(filePath, 'utf-8')
      return { name, content }
    } catch {
      return null
    }
  }

  /**
   * Build context for Claude to decide agent assignment
   */
  async buildAssignmentContext(
    task: string | { description?: string },
    projectPath: string
  ): Promise<AssignmentContext> {
    const agents = await this.getAgentNames()

    return {
      task: typeof task === 'string' ? task : task.description || '',
      availableAgents: agents,
      projectPath,
      projectId: this.projectId,
      // Claude reads this and decides via template
      _template: 'templates/agent-assignment.md',
    }
  }

  /**
   * Log agent usage to JSONL file
   */
  async logUsage(
    task: string | { description?: string },
    agent: string | { name?: string },
    _projectPath: string
  ): Promise<void> {
    try {
      const logPath = path.join(
        process.env.HOME || '',
        '.prjct-cli',
        'projects',
        this.projectId || '',
        'agent-usage.jsonl'
      )

      const entry =
        JSON.stringify({
          timestamp: new Date().toISOString(),
          task: typeof task === 'string' ? task : task.description,
          agent: typeof agent === 'string' ? agent : agent.name,
          projectId: this.projectId,
        }) + '\n'

      await fs.appendFile(logPath, entry)
    } catch {
      // Silent fail for logging
    }
  }
}

export default AgentRouter
