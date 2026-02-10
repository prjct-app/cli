/**
 * Unified Outcome Storage (PRJ-283)
 *
 * Single canonical storage for all outcomes (feature + task level).
 * Replaces the split between shipped.json and outcomes.jsonl.
 *
 * Write-through pattern: SQLite → MD → Event
 * Extends StorageManager for consistency with other storage classes.
 */

import type { FeatureOutcome, Learnings, OutcomesJson, TaskOutcome } from '../schemas/outcomes'
import {
  aggregateOutcomes,
  calculateROIScore,
  calculateVariance,
  DEFAULT_OUTCOMES,
  determineSuccessLevel,
} from '../schemas/outcomes'
import { StorageManager } from '../storage/storage-manager'
import type { ShippedFeature, ShippedJson } from '../types'
import { getTimestamp, toRelative } from '../utils/date-helper'

export class OutcomeStorage extends StorageManager<OutcomesJson> {
  constructor() {
    super('outcomes.json')
  }

  protected getDefault(): OutcomesJson {
    return { ...DEFAULT_OUTCOMES, lastUpdated: '' }
  }

  protected getMdFilename(): string {
    return 'outcomes.md'
  }

  protected getLayer(): string {
    return 'progress'
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `outcomes.${action}d`
  }

  protected toMarkdown(data: OutcomesJson): string {
    const lines = ['# OUTCOMES', '']

    if (data.outcomes.length === 0 && (!data.taskOutcomes || data.taskOutcomes.length === 0)) {
      lines.push('_No outcomes recorded yet._')
      lines.push('')
      return lines.join('\n')
    }

    // Recent feature outcomes (last 5)
    const recent = data.outcomes
      .sort((a, b) => new Date(b.shippedAt).getTime() - new Date(a.shippedAt).getTime())
      .slice(0, 5)

    if (recent.length > 0) {
      lines.push('## Recent Outcomes')
      lines.push('')

      for (const outcome of recent) {
        const success = outcome.success?.overallSuccess ?? 'unknown'
        const roi = outcome.roi.roiScore
        const rel = toRelative(outcome.shippedAt)
        lines.push(`- **${outcome.featureName}** (${success}, ROI: ${roi}) - ${rel}`)

        if (outcome.learnings.whatWorked.length > 0) {
          lines.push(`  What worked: ${outcome.learnings.whatWorked.slice(0, 2).join(', ')}`)
        }
        if (outcome.learnings.whatDidnt.length > 0) {
          lines.push(`  Issues: ${outcome.learnings.whatDidnt.slice(0, 2).join(', ')}`)
        }
      }
      lines.push('')
    }

    // Aggregates
    if (data.aggregates) {
      lines.push('## Aggregate Metrics')
      lines.push('')
      lines.push(`- Features: ${data.aggregates.totalFeatures}`)
      lines.push(`- Estimation Accuracy: ${data.aggregates.averageEstimationAccuracy}%`)
      lines.push(`- Success Rate: ${data.aggregates.averageSuccessRate}%`)
      lines.push(`- Average ROI: ${data.aggregates.averageROI}`)
      lines.push('')

      if (data.aggregates.topLearnings.length > 0) {
        lines.push('### Top Learnings')
        lines.push('')
        for (const learning of data.aggregates.topLearnings.slice(0, 5)) {
          lines.push(`- ${learning.insight} (${learning.frequency}x)`)
        }
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  // =========================================================================
  // Domain Methods
  // =========================================================================

  /**
   * Add a feature outcome.
   */
  async addFeatureOutcome(projectId: string, outcome: FeatureOutcome): Promise<void> {
    await this.update(projectId, (data) => ({
      ...data,
      outcomes: [outcome, ...data.outcomes],
      aggregates: aggregateOutcomes([outcome, ...data.outcomes]),
      lastUpdated: getTimestamp(),
    }))

    await this.publishEvent(projectId, 'outcome.recorded', {
      outcomeId: outcome.id,
      featureName: outcome.featureName,
      success: outcome.success?.overallSuccess,
    })
  }

  /**
   * Add a task outcome.
   */
  async addTaskOutcome(projectId: string, outcome: TaskOutcome): Promise<void> {
    await this.update(projectId, (data) => ({
      ...data,
      taskOutcomes: [outcome, ...(data.taskOutcomes || [])],
      lastUpdated: getTimestamp(),
    }))
  }

  /**
   * Get all feature outcomes.
   */
  async getFeatureOutcomes(projectId: string): Promise<FeatureOutcome[]> {
    const data = await this.read(projectId)
    return data.outcomes
  }

  /**
   * Get recent feature outcomes.
   */
  async getRecentOutcomes(projectId: string, limit: number = 10): Promise<FeatureOutcome[]> {
    const data = await this.read(projectId)
    return data.outcomes
      .sort((a, b) => new Date(b.shippedAt).getTime() - new Date(a.shippedAt).getTime())
      .slice(0, limit)
  }

  /**
   * Get task outcomes for a feature.
   */
  async getTaskOutcomes(projectId: string, featureId?: string): Promise<TaskOutcome[]> {
    const data = await this.read(projectId)
    const taskOutcomes = data.taskOutcomes || []

    if (featureId) {
      // Find matching feature outcome and return its task outcomes
      const feature = data.outcomes.find((o) => o.featureId === featureId)
      return feature?.taskOutcomes || []
    }

    return taskOutcomes
  }

  /**
   * Get aggregated metrics.
   */
  async getAggregates(projectId: string): Promise<OutcomesJson['aggregates']> {
    const data = await this.read(projectId)
    if (!data.aggregates && data.outcomes.length > 0) {
      // Compute on the fly if missing
      return aggregateOutcomes(data.outcomes)
    }
    return data.aggregates
  }

  /**
   * Reaggregate all outcomes (call after migration or bulk update).
   */
  async reaggregate(projectId: string): Promise<void> {
    await this.update(projectId, (data) => ({
      ...data,
      aggregates: aggregateOutcomes(data.outcomes),
      lastAggregated: getTimestamp(),
      lastUpdated: getTimestamp(),
    }))
  }

  // =========================================================================
  // Migration from shipped.json
  // =========================================================================

  /**
   * Migrate shipped features to unified outcome format.
   * Creates FeatureOutcome entries from ShippedFeature records.
   * Returns number of entries migrated.
   */
  migrateFromShipped(shippedData: ShippedJson): FeatureOutcome[] {
    return shippedData.shipped.map((ship) => this.convertShippedToOutcome(ship))
  }

  /**
   * Convert a single ShippedFeature to FeatureOutcome.
   */
  private convertShippedToOutcome(ship: ShippedFeature): FeatureOutcome {
    const durationMinutes = ship.duration ? this.parseDurationString(ship.duration) : 60
    const estimatedHours = durationMinutes / 60
    const actualHours = durationMinutes / 60
    const variance = calculateVariance(estimatedHours, actualHours)

    const learnings: Learnings = {
      whatWorked: [],
      whatDidnt: [],
      surprises: [],
      recommendations: [],
    }

    const successScore = 100 // Shipped = successful
    const roiScore = calculateROIScore(5, actualHours)

    return {
      id: `out_feat_${ship.id}`,
      featureId: ship.featureId || ship.id,
      featureName: ship.name,
      prdId: null,
      version: ship.version || undefined,
      branch: ship.commit?.branch || undefined,
      prUrl: undefined,
      effort: {
        estimated: {
          hours: estimatedHours,
          confidence: 'low',
          source: 'manual',
        },
        actual: {
          hours: actualHours,
          commits: ship.codeMetrics?.commits || undefined,
          linesAdded: ship.codeMetrics?.linesAdded || undefined,
          linesRemoved: ship.codeMetrics?.linesRemoved || undefined,
        },
        variance,
      },
      success: {
        metrics: [],
        acceptanceCriteria: [],
        overallSuccess: determineSuccessLevel(successScore),
        successScore,
      },
      learnings,
      roi: {
        valueDelivered: 5,
        userImpact: 'medium',
        businessImpact: 'medium',
        roiScore,
        worthIt: 'probably',
      },
      rating: 3,
      startedAt: ship.shippedAt,
      shippedAt: ship.shippedAt,
      legacy: true,
    }
  }

  /**
   * Parse duration string like "2h 30m" to minutes.
   */
  private parseDurationString(duration: string): number {
    let minutes = 0

    const hourMatch = duration.match(/(\d+)h/)
    if (hourMatch) {
      minutes += parseInt(hourMatch[1], 10) * 60
    }

    const minMatch = duration.match(/(\d+)m/)
    if (minMatch) {
      minutes += parseInt(minMatch[1], 10)
    }

    return minutes || 60 // Default 1h if unparseable
  }
}

export const outcomeStorage = new OutcomeStorage()
export default outcomeStorage
