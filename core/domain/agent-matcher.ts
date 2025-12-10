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

import fs from 'fs/promises'
import path from 'path'

interface Agent {
  name: string
  domain?: string
  content?: string
}

interface Task {
  description?: string
  type?: string
}

interface HistoryEntry {
  timestamp: string
  agent: string
  task: string
}

interface FormattedAgent {
  name: string
  domain: string
  hasContent: boolean
}

interface FormattedTask {
  description: string
  type: string
}

class AgentMatcher {
  historyPath: string | null = null

  /**
   * Set history path for logging
   * ORCHESTRATION: Path setup only
   */
  setHistoryPath(projectId: string): void {
    this.historyPath = path.join(
      process.env.HOME || '',
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
  formatAgentsForTemplate(agents: Agent[]): FormattedAgent[] {
    return agents.map((a) => ({
      name: a.name,
      domain: a.domain || 'general',
      hasContent: !!a.content,
    }))
  }

  /**
   * Format task for Claude
   * ORCHESTRATION: Data formatting only
   */
  formatTaskForTemplate(task: string | Task): FormattedTask {
    return {
      description: typeof task === 'string' ? task : task.description || '',
      type: typeof task === 'string' ? 'unknown' : task.type || 'unknown',
    }
  }

  /**
   * Record agent usage
   * ORCHESTRATION: File I/O only
   */
  async recordUsage(agent: string | Agent, task: string | Task): Promise<void> {
    if (!this.historyPath) return

    try {
      const entry =
        JSON.stringify({
          timestamp: new Date().toISOString(),
          agent: typeof agent === 'string' ? agent : agent.name,
          task: typeof task === 'string' ? task : task.description,
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
  async loadHistory(): Promise<HistoryEntry[]> {
    if (!this.historyPath) return []

    try {
      const content = await fs.readFile(this.historyPath, 'utf-8')
      return content
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as HistoryEntry
          } catch {
            return null
          }
        })
        .filter((entry): entry is HistoryEntry => entry !== null)
    } catch {
      return []
    }
  }
}

export default AgentMatcher
