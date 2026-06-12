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

// Types

interface VelocityStoreData {
  metrics: VelocityMetrics
  lastUpdated: string
}

// Velocity Storage

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

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `velocity.${action}d`
  }

  // Domain Methods

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

export const velocityStorage = new VelocityStorage()
