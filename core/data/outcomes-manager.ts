/**
 * Outcomes Manager
 *
 * Manages outcomes.json - task completion metrics and history.
 */

import { ArrayManager } from './base-manager'
import type { OutcomeSchema, OutcomesSchema, QualityScore } from '../schemas'

class OutcomesManager extends ArrayManager<OutcomeSchema> {
  constructor() {
    super('outcomes.json')
  }

  async getOutcomes(projectId: string): Promise<OutcomesSchema> {
    return this.read(projectId)
  }

  async getRecentOutcomes(projectId: string, limit = 20): Promise<OutcomesSchema> {
    const outcomes = await this.read(projectId)
    return outcomes
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, limit)
  }

  async addOutcome(
    projectId: string,
    outcome: Omit<OutcomeSchema, 'id' | 'completedAt'>
  ): Promise<OutcomesSchema> {
    const fullOutcome: OutcomeSchema = {
      ...outcome,
      id: `outcome_${Date.now()}`,
      completedAt: new Date().toISOString()
    }
    return this.add(projectId, fullOutcome)
  }

  async getByAgent(projectId: string, agentName: string): Promise<OutcomesSchema> {
    const outcomes = await this.read(projectId)
    return outcomes.filter((o) => o.agentUsed === agentName)
  }

  async getAverageQuality(projectId: string): Promise<number> {
    const outcomes = await this.read(projectId)
    if (outcomes.length === 0) return 0
    const sum = outcomes.reduce((acc, o) => acc + o.qualityScore, 0)
    return Math.round((sum / outcomes.length) * 10) / 10
  }

  async getCompletionRate(projectId: string): Promise<number> {
    const outcomes = await this.read(projectId)
    if (outcomes.length === 0) return 0
    const completed = outcomes.filter((o) => o.completedAsPlanned).length
    return Math.round((completed / outcomes.length) * 100)
  }

  async getTopBlockers(projectId: string, limit = 5): Promise<string[]> {
    const outcomes = await this.read(projectId)
    const blockerCounts = new Map<string, number>()

    for (const outcome of outcomes) {
      for (const blocker of outcome.blockers) {
        blockerCounts.set(blocker, (blockerCounts.get(blocker) || 0) + 1)
      }
    }

    return Array.from(blockerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([blocker]) => blocker)
  }

  async getAgentStats(
    projectId: string,
    agentName: string
  ): Promise<{ count: number; avgQuality: number; successRate: number }> {
    const agentOutcomes = await this.getByAgent(projectId, agentName)
    if (agentOutcomes.length === 0) {
      return { count: 0, avgQuality: 0, successRate: 0 }
    }

    const avgQuality =
      agentOutcomes.reduce((acc, o) => acc + o.qualityScore, 0) / agentOutcomes.length
    const successRate =
      (agentOutcomes.filter((o) => o.completedAsPlanned).length / agentOutcomes.length) * 100

    return {
      count: agentOutcomes.length,
      avgQuality: Math.round(avgQuality * 10) / 10,
      successRate: Math.round(successRate)
    }
  }
}

export const outcomesManager = new OutcomesManager()
export default outcomesManager
