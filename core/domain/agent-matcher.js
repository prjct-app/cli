/**
 * AgentMatcher - Orchestration Only
 *
 * AGENTIC: All matching decisions made by Claude via templates/agent-assignment.md
 * JS only orchestrates: format data, pass to Claude, return result
 *
 * NO scoring logic, NO algorithms, NO hardcoded weights
 *
 * @version 2.0.0
 */

const fs = require('fs').promises
const path = require('path')

class AgentMatcher {
  constructor() {
    this.historyPath = null
  }

  /**
   * Set history path for logging
   * ORCHESTRATION: Path setup only
   */
  setHistoryPath(projectId) {
    this.historyPath = path.join(
      process.env.HOME,
      '.prjct-cli',
      'projects',
      projectId,
      'agent-history.jsonl'
    )
  }

  /**
   * Format agents for Claude
   * ORCHESTRATION: Data formatting only
   */
  formatAgentsForTemplate(agents) {
    return agents.map(a => ({
      name: a.name,
      domain: a.domain || 'general',
      hasContent: !!a.content
    }))
  }

  /**
   * Format task for Claude
   * ORCHESTRATION: Data formatting only
   */
  formatTaskForTemplate(task) {
    return {
      description: typeof task === 'string' ? task : task.description,
      type: task.type || 'unknown'
    }
  }

  /**
   * Record agent usage
   * ORCHESTRATION: File I/O only
   */
  async recordUsage(agent, task) {
    if (!this.historyPath) return

    try {
      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        agent: agent.name || agent,
        task: typeof task === 'string' ? task : task.description
      }) + '\n'

      await fs.appendFile(this.historyPath, entry)
    } catch {
      // Silent fail
    }
  }

  /**
   * Load usage history
   * ORCHESTRATION: File I/O only
   */
  async loadHistory() {
    if (!this.historyPath) return []

    try {
      const content = await fs.readFile(this.historyPath, 'utf-8')
      return content
        .split('\n')
        .filter(Boolean)
        .map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        })
        .filter(Boolean)
    } catch {
      return []
    }
  }
}

module.exports = AgentMatcher
