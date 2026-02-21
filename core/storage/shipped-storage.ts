/**
 * Shipped Storage
 *
 * Manages shipped features via storage/shipped.json
 * Generates context/shipped.md for Claude
 */

import { generateUUID } from '../schemas/schemas'
import { ShippedJsonSchema } from '../schemas/shipped'
import type { ShippedFeature, ShippedJson } from '../types/storage'
import { getDaysAgo, getTimestamp } from '../utils/date-helper'
import { ARCHIVE_POLICIES, archiveStorage } from './archive-storage'
import { StorageManager } from './storage-manager'

class ShippedStorage extends StorageManager<ShippedJson> {
  constructor() {
    super('shipped.json', ShippedJsonSchema)
  }

  protected getDefault(): ShippedJson {
    return {
      shipped: [],
      lastUpdated: '',
    }
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `shipped.${action}d`
  }

  // =========== Domain Methods ===========

  /**
   * Get all shipped features
   */
  async getAll(projectId: string): Promise<ShippedFeature[]> {
    const data = await this.read(projectId)
    return data.shipped
  }

  /**
   * Get recent shipped features
   */
  async getRecent(projectId: string, limit: number = 5): Promise<ShippedFeature[]> {
    const data = await this.read(projectId)
    return data.shipped
      .sort((a, b) => new Date(b.shippedAt).getTime() - new Date(a.shippedAt).getTime())
      .slice(0, limit)
  }

  /**
   * Add a shipped feature
   */
  async addShipped(
    projectId: string,
    feature: Omit<ShippedFeature, 'id' | 'shippedAt'>
  ): Promise<ShippedFeature> {
    const shipped: ShippedFeature = {
      ...feature,
      id: generateUUID(),
      shippedAt: getTimestamp(),
    }

    await this.update(projectId, (data) => ({
      shipped: [shipped, ...data.shipped], // Prepend
      lastUpdated: getTimestamp(),
    }))

    // Publish event
    await this.publishEvent(projectId, 'feature.shipped', {
      shipId: shipped.id,
      name: shipped.name,
      version: shipped.version,
      shippedAt: shipped.shippedAt,
    })

    return shipped
  }

  /**
   * Get shipped by version
   */
  async getByVersion(projectId: string, version: string): Promise<ShippedFeature | undefined> {
    const data = await this.read(projectId)
    return data.shipped.find((s) => s.version === version)
  }

  /**
   * Get count
   */
  async getCount(projectId: string): Promise<number> {
    const data = await this.read(projectId)
    return data.shipped.length
  }

  /**
   * Get shipped in date range
   */
  async getByDateRange(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ShippedFeature[]> {
    const data = await this.read(projectId)
    return data.shipped.filter((s) => {
      const date = new Date(s.shippedAt)
      return date >= startDate && date <= endDate
    })
  }

  /**
   * Get stats for a period
   */
  async getStats(
    projectId: string,
    period: 'week' | 'month' | 'year' = 'month'
  ): Promise<{ count: number; period: string }> {
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
    }

    const shipped = await this.getByDateRange(projectId, startDate, now)

    return {
      count: shipped.length,
      period,
    }
  }

  /**
   * Archive shipped features older than retention period (PRJ-267).
   * Moves old items to archive table, keeps 1-line summary in active storage.
   * Returns count of archived items.
   */
  async archiveOldShipped(projectId: string): Promise<number> {
    const data = await this.read(projectId)
    const threshold = getDaysAgo(ARCHIVE_POLICIES.SHIPPED_RETENTION_DAYS)

    const stale = data.shipped.filter((s) => new Date(s.shippedAt) < threshold)

    if (stale.length === 0) return 0

    // Persist to archive table
    archiveStorage.archiveMany(
      projectId,
      stale.map((s) => ({
        entityType: 'shipped' as const,
        entityId: s.id,
        entityData: s,
        summary: `${s.name} v${s.version}`,
        reason: 'age',
      }))
    )

    // Remove from active storage
    const freshIds = new Set(
      data.shipped.filter((s) => new Date(s.shippedAt) >= threshold).map((s) => s.id)
    )

    await this.update(projectId, (d) => ({
      shipped: d.shipped.filter((s) => freshIds.has(s.id)),
      lastUpdated: getTimestamp(),
    }))

    await this.publishEvent(projectId, 'shipped.archived', {
      count: stale.length,
      oldestShippedAt: stale[stale.length - 1]?.shippedAt,
    })

    return stale.length
  }
}

export const shippedStorage = new ShippedStorage()
export default shippedStorage
