/**
 * Shipped Storage
 *
 * Manages shipped features via storage/shipped.json
 * Generates context/shipped.md for Claude
 */

import { StorageManager } from './storage-manager'
import { generateUUID } from '../schemas'
import { getTimestamp } from '../utils/date-helper'

export interface ShippedFeature {
  id: string
  name: string
  shippedAt: string
  version: string
  description?: string
  tasks?: string[] // Task IDs that were part of this ship
  duration?: string // How long it took
}

export interface ShippedJson {
  shipped: ShippedFeature[]
  lastUpdated: string
}

class ShippedStorage extends StorageManager<ShippedJson> {
  constructor() {
    super('shipped.json')
  }

  protected getDefault(): ShippedJson {
    return {
      shipped: [],
      lastUpdated: ''
    }
  }

  protected getMdFilename(): string {
    return 'shipped.md'
  }

  protected getLayer(): string {
    return 'progress'
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `shipped.${action}d`
  }

  protected toMarkdown(data: ShippedJson): string {
    const lines = ['# SHIPPED \u{1F680}', '']

    if (data.shipped.length === 0) {
      lines.push('_No features shipped yet. Use /p:ship to celebrate!_')
      lines.push('')
      return lines.join('\n')
    }

    // Group by month
    const byMonth = new Map<string, ShippedFeature[]>()

    data.shipped.forEach(ship => {
      const date = new Date(ship.shippedAt)
      const month = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })

      if (!byMonth.has(month)) {
        byMonth.set(month, [])
      }
      byMonth.get(month)!.push(ship)
    })

    // Render by month (most recent first)
    const sortedMonths = Array.from(byMonth.keys()).sort((a, b) => {
      const dateA = new Date(byMonth.get(a)![0].shippedAt)
      const dateB = new Date(byMonth.get(b)![0].shippedAt)
      return dateB.getTime() - dateA.getTime()
    })

    sortedMonths.forEach(month => {
      lines.push(`## ${month}`)
      lines.push('')

      const ships = byMonth.get(month)!.sort(
        (a, b) => new Date(b.shippedAt).getTime() - new Date(a.shippedAt).getTime()
      )

      ships.forEach(ship => {
        const date = new Date(ship.shippedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
        const version = ship.version ? ` v${ship.version}` : ''
        const duration = ship.duration ? ` (${ship.duration})` : ''
        lines.push(`- **${ship.name}**${version}${duration} - ${date}`)
        if (ship.description) {
          lines.push(`  _${ship.description}_`)
        }
      })

      lines.push('')
    })

    // Stats
    lines.push('---')
    lines.push('')
    lines.push(`**Total shipped:** ${data.shipped.length}`)
    lines.push('')

    return lines.join('\n')
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
      shippedAt: getTimestamp()
    }

    await this.update(projectId, (data) => ({
      shipped: [shipped, ...data.shipped], // Prepend
      lastUpdated: getTimestamp()
    }))

    // Publish event
    await this.publishEvent(projectId, 'feature.shipped', {
      shipId: shipped.id,
      name: shipped.name,
      version: shipped.version,
      shippedAt: shipped.shippedAt
    })

    return shipped
  }

  /**
   * Get shipped by version
   */
  async getByVersion(
    projectId: string,
    version: string
  ): Promise<ShippedFeature | undefined> {
    const data = await this.read(projectId)
    return data.shipped.find(s => s.version === version)
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
    return data.shipped.filter(s => {
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
      period
    }
  }
}

export const shippedStorage = new ShippedStorage()
export default shippedStorage
