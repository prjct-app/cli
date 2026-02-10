/**
 * Outcome Analyzer
 *
 * Analyzes outcomes to extract patterns and insights.
 * Powers the learning loop for better estimates and agent selection.
 */

import type { AgentMetrics, DetectedPattern, Outcome, OutcomeSummary } from '../types'
import outcomeRecorder from './outcome-recorder'

/**
 * OutcomeAnalyzer - Extracts insights from outcomes.
 */
export class OutcomeAnalyzer {
  /**
   * Generate summary of all outcomes.
   */
  async summarize(projectId: string): Promise<OutcomeSummary> {
    const outcomes = await outcomeRecorder.getAll(projectId)

    if (outcomes.length === 0) {
      return {
        totalOutcomes: 0,
        avgQualityScore: 0,
        estimateAccuracy: 0,
        topBlockers: [],
        topAgents: [],
        patternsDetected: [],
      }
    }

    // Calculate average quality
    const avgQuality = outcomes.reduce((sum, o) => sum + o.qualityScore, 0) / outcomes.length

    // Calculate estimate accuracy
    const estimateAccuracy = await outcomeRecorder.getEstimateAccuracy(projectId)

    // Find top blockers
    const blockerCounts = new Map<string, number>()
    for (const outcome of outcomes) {
      for (const blocker of outcome.blockers || []) {
        blockerCounts.set(blocker, (blockerCounts.get(blocker) || 0) + 1)
      }
    }
    const topBlockers = [...blockerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([blocker]) => blocker)

    // Find top agents
    const agentMetrics = await this.getAgentMetrics(projectId)
    const topAgents = agentMetrics
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3)
      .map((m) => m.agent)

    // Detect patterns
    const patterns = await this.detectPatterns(projectId)
    const patternsDetected = patterns.map((p) => p.description)

    return {
      totalOutcomes: outcomes.length,
      avgQualityScore: Math.round(avgQuality * 10) / 10,
      estimateAccuracy,
      topBlockers,
      topAgents,
      patternsDetected,
    }
  }

  /**
   * Get metrics for each agent.
   */
  async getAgentMetrics(projectId: string): Promise<AgentMetrics[]> {
    const outcomes = await outcomeRecorder.getAll(projectId)

    // Group by agent
    const byAgent = new Map<string, Outcome[]>()
    for (const outcome of outcomes) {
      const agent = outcome.agentUsed || 'unknown'
      if (!byAgent.has(agent)) {
        byAgent.set(agent, [])
      }
      byAgent.get(agent)!.push(outcome)
    }

    const metrics: AgentMetrics[] = []

    for (const [agent, agentOutcomes] of byAgent) {
      const tasksCompleted = agentOutcomes.length
      const successful = agentOutcomes.filter((o) => o.completedAsPlanned)
      const successRate = Math.round((successful.length / tasksCompleted) * 100)

      const avgQuality = agentOutcomes.reduce((sum, o) => sum + o.qualityScore, 0) / tasksCompleted

      // Calculate estimate accuracy for this agent
      const accurateEstimates = agentOutcomes.filter((o) => {
        if (!o.variance) return false
        const variance = this.parseVariance(o.variance)
        const estimated = this.parseDuration(o.estimatedDuration)
        if (estimated === 0) return false
        return Math.abs(variance) / estimated <= 0.2
      })
      const estimateAccuracy = Math.round((accurateEstimates.length / tasksCompleted) * 100)

      // Find best task types
      const taskTypes = new Map<string, number>()
      for (const o of agentOutcomes.filter((o) => o.completedAsPlanned)) {
        for (const tag of o.tags || []) {
          taskTypes.set(tag, (taskTypes.get(tag) || 0) + 1)
        }
      }
      const bestFor = [...taskTypes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type]) => type)

      metrics.push({
        agent,
        tasksCompleted,
        successRate,
        avgQualityScore: Math.round(avgQuality * 10) / 10,
        estimateAccuracy,
        bestFor,
      })
    }

    return metrics
  }

  /**
   * Detect patterns from outcomes.
   */
  async detectPatterns(projectId: string): Promise<DetectedPattern[]> {
    const outcomes = await outcomeRecorder.getAll(projectId)
    const patterns: DetectedPattern[] = []

    if (outcomes.length < 3) {
      return patterns // Need at least 3 outcomes to detect patterns
    }

    // Pattern: Consistent underestimation
    const underestimated = outcomes.filter((o) => {
      const variance = this.parseVariance(o.variance)
      return variance > 0
    })
    if (underestimated.length / outcomes.length > 0.6) {
      patterns.push({
        description: 'Tasks consistently take longer than estimated',
        confidence: underestimated.length / outcomes.length,
        occurrences: underestimated.length,
        suggestedAction: 'Add 30% buffer to estimates',
      })
    }

    // Pattern: Consistent overestimation
    const overestimated = outcomes.filter((o) => {
      const variance = this.parseVariance(o.variance)
      return variance < 0
    })
    if (overestimated.length / outcomes.length > 0.6) {
      patterns.push({
        description: 'Tasks consistently finish faster than estimated',
        confidence: overestimated.length / outcomes.length,
        occurrences: overestimated.length,
        suggestedAction: 'Reduce estimates by 20%',
      })
    }

    // Pattern: Common blockers
    const blockerCounts = new Map<string, number>()
    for (const outcome of outcomes) {
      for (const blocker of outcome.blockers || []) {
        blockerCounts.set(blocker, (blockerCounts.get(blocker) || 0) + 1)
      }
    }
    for (const [blocker, count] of blockerCounts) {
      if (count >= 3) {
        patterns.push({
          description: `Recurring blocker: ${blocker}`,
          confidence: count / outcomes.length,
          occurrences: count,
          suggestedAction: `Address root cause of "${blocker}"`,
        })
      }
    }

    // Pattern: Agent performance
    const agentMetrics = await this.getAgentMetrics(projectId)
    for (const metrics of agentMetrics) {
      if (metrics.tasksCompleted >= 5 && metrics.successRate > 90) {
        patterns.push({
          description: `${metrics.agent} has high success rate (${metrics.successRate}%)`,
          confidence: 0.9,
          occurrences: metrics.tasksCompleted,
          suggestedAction: `Prefer ${metrics.agent} for similar tasks`,
        })
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Suggest estimate for a task type based on history.
   */
  async suggestEstimate(projectId: string, taskType: string): Promise<string | null> {
    const outcomes = await outcomeRecorder.getAll(projectId)

    // Filter by task type (using tags)
    const relevant = outcomes.filter((o) => o.tags?.includes(taskType))

    if (relevant.length < 2) {
      return null // Not enough data
    }

    // Calculate average actual duration
    const totalMinutes = relevant.reduce((sum, o) => {
      return sum + this.parseDuration(o.actualDuration)
    }, 0)

    const avgMinutes = Math.round(totalMinutes / relevant.length)

    // Format as duration string
    if (avgMinutes >= 60) {
      const hours = Math.floor(avgMinutes / 60)
      const mins = avgMinutes % 60
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${avgMinutes}m`
  }

  /**
   * Suggest best agent for a task type.
   */
  async suggestAgent(projectId: string, taskType: string): Promise<string | null> {
    const agentMetrics = await this.getAgentMetrics(projectId)

    // Find agents good at this task type
    const suitable = agentMetrics.filter((m) => m.bestFor.includes(taskType))

    if (suitable.length === 0) {
      return null
    }

    // Return the one with highest success rate
    return suitable.sort((a, b) => b.successRate - a.successRate)[0].agent
  }

  /**
   * Parse variance string to minutes.
   */
  private parseVariance(variance: string): number {
    const match = variance.match(/^([+-])(\d+)([mh])$/)
    if (!match) return 0

    const sign = match[1] === '-' ? -1 : 1
    const value = parseInt(match[2], 10)
    const unit = match[3]

    return sign * (unit === 'h' ? value * 60 : value)
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
}

// Singleton instance
const outcomeAnalyzer = new OutcomeAnalyzer()
export default outcomeAnalyzer
