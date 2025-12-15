/**
 * Agent Router
 * Orchestrates agent loading and context building for Claude delegation.
 *
 * Loads agents from two locations:
 * 1. {projectPath}/.claude/agents/ - Claude Code sub-agents (PRIMARY, per-project)
 * 2. ~/.prjct-cli/projects/{id}/agents/ - Legacy agents (fallback)
 *
 * Claude Code sub-agents are prioritized as they're more specific to the project.
 *
 * @module agentic/agent-router
 * @version 3.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'

interface Agent {
  name: string
  content: string
  source: 'claude-code' | 'legacy'
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
  projectPath: string | null = null
  legacyAgentsPath: string | null = null

  /**
   * Get path to Claude Code sub-agents directory
   */
  getClaudeCodeAgentsPath(): string | null {
    if (!this.projectPath) return null
    return path.join(this.projectPath, '.claude', 'agents')
  }

  /**
   * Initialize router with project context
   */
  async initialize(projectPath: string): Promise<void> {
    this.projectId = await configManager.getProjectId(projectPath)
    this.projectPath = projectPath
    this.legacyAgentsPath = pathManager.getPath(this.projectId!, 'agents')
  }

  /**
   * Load agents from a specific directory
   */
  private async loadAgentsFromPath(
    agentsPath: string,
    source: 'claude-code' | 'legacy'
  ): Promise<Agent[]> {
    try {
      const files = await fs.readdir(agentsPath)
      const agents: Agent[] = []

      for (const file of files) {
        if (file.endsWith('.md')) {
          const name = file.replace('.md', '')
          const content = await fs.readFile(path.join(agentsPath, file), 'utf-8')
          agents.push({ name, content, source })
        }
      }

      return agents
    } catch {
      return []
    }
  }

  /**
   * Load all available agents from both Claude Code and legacy locations
   * Claude Code sub-agents take priority over legacy agents with same name
   */
  async loadAvailableAgents(): Promise<Agent[]> {
    const agentMap = new Map<string, Agent>()

    // Load legacy agents first (lower priority)
    if (this.legacyAgentsPath) {
      const legacyAgents = await this.loadAgentsFromPath(this.legacyAgentsPath, 'legacy')
      for (const agent of legacyAgents) {
        agentMap.set(agent.name, agent)
      }
    }

    // Load Claude Code sub-agents (higher priority - overwrites legacy)
    const claudeCodePath = this.getClaudeCodeAgentsPath()
    if (claudeCodePath) {
      const claudeCodeAgents = await this.loadAgentsFromPath(claudeCodePath, 'claude-code')
      for (const agent of claudeCodeAgents) {
        agentMap.set(agent.name, agent)
      }
    }

    return Array.from(agentMap.values())
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
   * Checks Claude Code sub-agents first, then falls back to legacy
   */
  async loadAgent(name: string): Promise<Agent | null> {
    // Try Claude Code sub-agents first (higher priority)
    const claudeCodePath = this.getClaudeCodeAgentsPath()
    if (claudeCodePath) {
      try {
        const filePath = path.join(claudeCodePath, `${name}.md`)
        const content = await fs.readFile(filePath, 'utf-8')
        return { name, content, source: 'claude-code' }
      } catch {
        // Not found in Claude Code path, try legacy
      }
    }

    // Fall back to legacy agents
    if (this.legacyAgentsPath) {
      try {
        const filePath = path.join(this.legacyAgentsPath, `${name}.md`)
        const content = await fs.readFile(filePath, 'utf-8')
        return { name, content, source: 'legacy' }
      } catch {
        // Not found
      }
    }

    return null
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
