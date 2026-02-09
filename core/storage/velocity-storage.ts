/**
 * Velocity Storage (PRJ-296)
 *
 * Manages velocity metrics with write-through pattern:
 * - storage/velocity.json → source of truth
 * - context/velocity.md → Claude-readable summary
 *
 * Extends StorageManager for consistency with existing storage classes.
 */

import type { VelocityMetrics } from '../schemas/velocity'
import { DEFAULT_VELOCITY_METRICS } from '../schemas/velocity'
import { StorageManager } from './storage-manager'

// =============================================================================
// Types
// =============================================================================

interface VelocityStoreData {
  metrics: VelocityMetrics
  lastUpdated: string
}

// =============================================================================
// Velocity Storage
// =============================================================================

class VelocityStorage extends StorageManager<VelocityStoreData> {
  constructor() {
    super('velocity.json')
  }

  protected getDefault(): VelocityStoreData {
    return {
      metrics: DEFAULT_VELOCITY_METRICS,
      lastUpdated: '',
    }
  }

  protected getMdFilename(): string {
    return 'velocity.md'
  }

  protected getLayer(): string {
    return 'progress'
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `velocity.${action}d`
  }

  protected toMarkdown(data: VelocityStoreData): string {
    const { metrics } = data
    const lines = ['# Velocity', '']

    if (metrics.sprints.length === 0) {
      lines.push('_No velocity data yet. Complete tasks with estimates to build velocity history._')
      lines.push('')
      return lines.join('\n')
    }

    // Summary
    lines.push(`**Average**: ${metrics.averageVelocity} pts/sprint`)
    lines.push(`**Trend**: ${formatTrendIcon(metrics.velocityTrend)} ${metrics.velocityTrend}`)
    lines.push(`**Estimation Accuracy**: ${metrics.estimationAccuracy}%`)
    lines.push('')

    // Sprint table
    lines.push('## Sprint History')
    lines.push('')
    lines.push('| Sprint | Points | Tasks | Accuracy | Variance |')
    lines.push('|--------|--------|-------|----------|----------|')

    const recentSprints = metrics.sprints.slice(-6)
    for (const sprint of recentSprints) {
      lines.push(
        `| ${sprint.sprintNumber} | ${sprint.pointsCompleted} | ${sprint.tasksCompleted} | ${sprint.estimationAccuracy}% | ${sprint.avgVariance > 0 ? '+' : ''}${sprint.avgVariance}% |`
      )
    }
    lines.push('')

    // Patterns
    if (metrics.underEstimated.length > 0 || metrics.overEstimated.length > 0) {
      lines.push('## Estimation Patterns')
      lines.push('')

      for (const p of metrics.underEstimated) {
        lines.push(
          `- ⚠ **${p.category}**: underestimated by avg ${p.avgVariance}% (${p.taskCount} tasks)`
        )
      }
      for (const p of metrics.overEstimated) {
        lines.push(
          `- ✓ **${p.category}**: overestimated by avg ${p.avgVariance}% (${p.taskCount} tasks)`
        )
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  // ===========================================================================
  // Domain Methods
  // ===========================================================================

  /**
   * Save computed velocity metrics.
   */
  async saveMetrics(projectId: string, metrics: VelocityMetrics): Promise<void> {
    await this.write(projectId, {
      metrics,
      lastUpdated: metrics.lastUpdated,
    })

    await this.publishEntityEvent(projectId, 'velocity', 'updated', {
      averageVelocity: metrics.averageVelocity,
      trend: metrics.velocityTrend,
      sprintCount: metrics.sprints.length,
    })
  }

  /**
   * Get current velocity metrics.
   */
  async getMetrics(projectId: string): Promise<VelocityMetrics> {
    const data = await this.read(projectId)
    return data.metrics
  }
}

// =============================================================================
// Helpers
// =============================================================================

function formatTrendIcon(trend: string): string {
  switch (trend) {
    case 'improving':
      return '↑'
    case 'declining':
      return '↓'
    default:
      return '→'
  }
}

export const velocityStorage = new VelocityStorage()
export default velocityStorage
export type { VelocityStoreData }
