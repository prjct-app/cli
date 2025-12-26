/**
 * Agent Performance Tracker
 *
 * Tracks agent performance for intelligent routing.
 * Enables learning which agent works best for which task type.
 */

import path from 'path'
import * as fileHelper from '../utils/file-helper'
import pathManager from '../infrastructure/path-manager'
import type {
  AgentPerformance,
  AgentTaskRecord,
  AgentSuggestion,
  AgentPerformanceSummary,
  TaskType,
} from '../types'

const PERFORMANCE_DIR = 'analysis'
const PERFORMANCE_FILE = 'agent-performance.json'
const RECORDS_FILE = 'agent-records.jsonl'

/**
 * AgentPerformanceTracker - Tracks and analyzes agent performance.
 */
export class AgentPerformanceTracker {
  /**
   * Get performance directory path for a project.
   */
  private getPerformanceDir(projectId: string): string {
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    return path.join(globalPath, PERFORMANCE_DIR)
  }

  /**
   * Get performance file path.
   */
  private getPerformancePath(projectId: string): string {
    return path.join(this.getPerformanceDir(projectId), PERFORMANCE_FILE)
  }

  /**
   * Get records file path.
   */
  private getRecordsPath(projectId: string): string {
    return path.join(this.getPerformanceDir(projectId), RECORDS_FILE)
  }

  /**
   * Record a task completion for an agent.
   */
  async recordTask(projectId: string, record: AgentTaskRecord): Promise<void> {
    const recordsPath = this.getRecordsPath(projectId)

    // Ensure directory exists
    await fileHelper.ensureDir(path.dirname(recordsPath))

    // Append record
    await fileHelper.appendLine(recordsPath, JSON.stringify(record))

    // Update performance summary
    await this.updatePerformance(projectId, record)
  }

  /**
   * Get all task records for a project.
   */
  async getRecords(projectId: string): Promise<AgentTaskRecord[]> {
    const recordsPath = this.getRecordsPath(projectId)

    if (!(await fileHelper.fileExists(recordsPath))) {
      return []
    }

    const content = await fileHelper.readFile(recordsPath)
    if (!content.trim()) {
      return []
    }

    return content
      .trim()
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as AgentTaskRecord)
  }

  /**
   * Get all agent performance data.
   */
  async getAllPerformance(projectId: string): Promise<AgentPerformance[]> {
    const perfPath = this.getPerformancePath(projectId)

    if (!(await fileHelper.fileExists(perfPath))) {
      return []
    }

    const data = await fileHelper.readJson<{ agents: AgentPerformance[] }>(
      perfPath,
      { agents: [] }
    )
    return data?.agents ?? []
  }

  /**
   * Get performance for a specific agent.
   */
  async getAgentPerformance(
    projectId: string,
    agentName: string
  ): Promise<AgentPerformance | null> {
    const all = await this.getAllPerformance(projectId)
    return all.find((a) => a.agentName === agentName) || null
  }

  /**
   * Update performance summary after a task completion.
   */
  private async updatePerformance(
    projectId: string,
    record: AgentTaskRecord
  ): Promise<void> {
    const perfPath = this.getPerformancePath(projectId)
    await fileHelper.ensureDir(path.dirname(perfPath))

    const data = await fileHelper.readJson<{ agents: AgentPerformance[] }>(
      perfPath,
      { agents: [] }
    )

    if (!data) return

    // Find or create agent performance
    let agentPerf = data.agents.find((a) => a.agentName === record.agentName)

    if (!agentPerf) {
      agentPerf = {
        agentName: record.agentName,
        taskType: record.taskType,
        tasksCompleted: 0,
        successRate: 0,
        avgDuration: '0m',
        estimateAccuracy: 0,
        improving: false,
        lastUpdated: new Date().toISOString(),
        bestFor: [],
        avoidFor: [],
      }
      data.agents.push(agentPerf)
    }

    // Get all records for this agent
    const allRecords = await this.getRecords(projectId)
    const agentRecords = allRecords.filter((r) => r.agentName === record.agentName)

    // Calculate updated stats
    agentPerf.tasksCompleted = agentRecords.length
    agentPerf.successRate = Math.round(
      (agentRecords.filter((r) => r.success).length / agentRecords.length) * 100
    )
    agentPerf.avgDuration = this.calculateAvgDuration(agentRecords)
    agentPerf.estimateAccuracy = this.calculateEstimateAccuracy(agentRecords)
    agentPerf.lastUpdated = new Date().toISOString()

    // Calculate best/avoid task types
    const taskTypeStats = this.calculateTaskTypeStats(agentRecords)
    agentPerf.bestFor = taskTypeStats.bestFor
    agentPerf.avoidFor = taskTypeStats.avoidFor

    // Check if improving (compare last 5 vs previous 5)
    agentPerf.improving = this.checkImproving(agentRecords)

    await fileHelper.writeJson(perfPath, data)
  }

  /**
   * Calculate average duration from records.
   */
  private calculateAvgDuration(records: AgentTaskRecord[]): string {
    if (records.length === 0) return '0m'

    const totalMinutes = records.reduce((sum, r) => {
      return sum + this.parseDuration(r.actualDuration)
    }, 0)

    const avgMinutes = Math.round(totalMinutes / records.length)

    if (avgMinutes >= 60) {
      const hours = Math.floor(avgMinutes / 60)
      const mins = avgMinutes % 60
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${avgMinutes}m`
  }

  /**
   * Calculate estimate accuracy from records.
   */
  private calculateEstimateAccuracy(records: AgentTaskRecord[]): number {
    if (records.length === 0) return 0

    const accurateCount = records.filter((r) => {
      const estimated = this.parseDuration(r.estimatedDuration)
      const actual = this.parseDuration(r.actualDuration)
      if (estimated === 0) return false
      return Math.abs(actual - estimated) / estimated <= 0.2
    }).length

    return Math.round((accurateCount / records.length) * 100)
  }

  /**
   * Calculate best and avoid task types for an agent.
   */
  private calculateTaskTypeStats(records: AgentTaskRecord[]): {
    bestFor: TaskType[]
    avoidFor: TaskType[]
  } {
    const byType = new Map<TaskType, { success: number; total: number }>()

    for (const record of records) {
      const stats = byType.get(record.taskType) || { success: 0, total: 0 }
      stats.total++
      if (record.success) stats.success++
      byType.set(record.taskType, stats)
    }

    const bestFor: TaskType[] = []
    const avoidFor: TaskType[] = []

    for (const [taskType, stats] of byType) {
      if (stats.total < 2) continue // Need at least 2 tasks

      const successRate = stats.success / stats.total

      if (successRate >= 0.8) {
        bestFor.push(taskType)
      } else if (successRate < 0.5) {
        avoidFor.push(taskType)
      }
    }

    return { bestFor, avoidFor }
  }

  /**
   * Check if agent performance is improving.
   */
  private checkImproving(records: AgentTaskRecord[]): boolean {
    if (records.length < 10) return false

    const recent = records.slice(-5)
    const previous = records.slice(-10, -5)

    const recentSuccess = recent.filter((r) => r.success).length / 5
    const previousSuccess = previous.filter((r) => r.success).length / 5

    return recentSuccess > previousSuccess
  }

  /**
   * Parse duration string to minutes.
   */
  private parseDuration(duration: string): number {
    let minutes = 0

    const hourMatch = duration.match(/(\d+)h/)
    if (hourMatch) {
      minutes += parseInt(hourMatch[1], 10) * 60
    }

    const minMatch = duration.match(/(\d+)m/)
    if (minMatch) {
      minutes += parseInt(minMatch[1], 10)
    }

    return minutes
  }

  /**
   * Suggest the best agent for a task type.
   */
  async suggestAgent(
    projectId: string,
    taskType: TaskType
  ): Promise<AgentSuggestion | null> {
    const allPerf = await this.getAllPerformance(projectId)

    if (allPerf.length === 0) {
      return null
    }

    // Find agents good at this task type
    const suitable = allPerf.filter(
      (a) => a.bestFor.includes(taskType) && !a.avoidFor.includes(taskType)
    )

    if (suitable.length > 0) {
      // Sort by success rate
      suitable.sort((a, b) => b.successRate - a.successRate)
      const best = suitable[0]

      return {
        agentName: best.agentName,
        confidence: best.successRate / 100,
        reason: `Best success rate (${best.successRate}%) for ${taskType} tasks`,
        alternatives: suitable.slice(1, 3).map((a) => a.agentName),
      }
    }

    // Fallback to most experienced agent
    const byExperience = [...allPerf].sort(
      (a, b) => b.tasksCompleted - a.tasksCompleted
    )
    const fallback = byExperience[0]

    return {
      agentName: fallback.agentName,
      confidence: 0.5,
      reason: `Most experienced agent (${fallback.tasksCompleted} tasks)`,
      alternatives: byExperience.slice(1, 3).map((a) => a.agentName),
    }
  }

  /**
   * Get performance summary for a project.
   */
  async getSummary(projectId: string): Promise<AgentPerformanceSummary> {
    const allPerf = await this.getAllPerformance(projectId)

    if (allPerf.length === 0) {
      return {
        totalAgents: 0,
        topPerformer: null,
        mostUsed: null,
        avgSuccessRate: 0,
        byTaskType: {} as Record<TaskType, string | null>,
      }
    }

    // Find top performer
    const bySuccess = [...allPerf].sort((a, b) => b.successRate - a.successRate)
    const topPerformer = bySuccess[0].agentName

    // Find most used
    const byTasks = [...allPerf].sort((a, b) => b.tasksCompleted - a.tasksCompleted)
    const mostUsed = byTasks[0].agentName

    // Average success rate
    const avgSuccessRate = Math.round(
      allPerf.reduce((sum, a) => sum + a.successRate, 0) / allPerf.length
    )

    // Best agent by task type
    const taskTypes: TaskType[] = [
      'frontend',
      'backend',
      'devops',
      'database',
      'testing',
      'documentation',
      'refactoring',
      'bugfix',
      'feature',
      'design',
      'other',
    ]
    const byTaskType: Record<TaskType, string | null> = {} as Record<
      TaskType,
      string | null
    >

    for (const taskType of taskTypes) {
      const best = allPerf.find((a) => a.bestFor.includes(taskType))
      byTaskType[taskType] = best?.agentName || null
    }

    return {
      totalAgents: allPerf.length,
      topPerformer,
      mostUsed,
      avgSuccessRate,
      byTaskType,
    }
  }

  /**
   * Generate markdown report of agent performance.
   */
  async generateReport(projectId: string): Promise<string> {
    const allPerf = await this.getAllPerformance(projectId)
    const summary = await this.getSummary(projectId)

    const lines: string[] = []

    lines.push('# Agent Performance Report')
    lines.push('')
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push('')

    lines.push('## Summary')
    lines.push('')
    lines.push(`- **Total Agents**: ${summary.totalAgents}`)
    lines.push(`- **Top Performer**: ${summary.topPerformer || 'N/A'}`)
    lines.push(`- **Most Used**: ${summary.mostUsed || 'N/A'}`)
    lines.push(`- **Avg Success Rate**: ${summary.avgSuccessRate}%`)
    lines.push('')

    if (allPerf.length > 0) {
      lines.push('## Agent Details')
      lines.push('')

      for (const agent of allPerf) {
        lines.push(`### ${agent.agentName}`)
        lines.push('')
        lines.push(`- **Tasks Completed**: ${agent.tasksCompleted}`)
        lines.push(`- **Success Rate**: ${agent.successRate}%`)
        lines.push(`- **Avg Duration**: ${agent.avgDuration}`)
        lines.push(`- **Estimate Accuracy**: ${agent.estimateAccuracy}%`)
        lines.push(`- **Improving**: ${agent.improving ? 'Yes' : 'No'}`)

        if (agent.bestFor.length > 0) {
          lines.push(`- **Best For**: ${agent.bestFor.join(', ')}`)
        }
        if (agent.avoidFor.length > 0) {
          lines.push(`- **Avoid For**: ${agent.avoidFor.join(', ')}`)
        }
        lines.push('')
      }
    }

    lines.push('## Task Type Routing')
    lines.push('')
    lines.push('| Task Type | Recommended Agent |')
    lines.push('|-----------|-------------------|')

    for (const [taskType, agent] of Object.entries(summary.byTaskType)) {
      lines.push(`| ${taskType} | ${agent || 'No data'} |`)
    }

    return lines.join('\n')
  }
}

// Singleton instance
const agentPerformanceTracker = new AgentPerformanceTracker()
export default agentPerformanceTracker
