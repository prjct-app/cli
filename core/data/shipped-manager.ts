/**
 * Shipped Manager
 *
 * Manages shipped.json - completed/shipped items history.
 */

import { ArrayManager } from './base-manager'
import type { ShippedItemSchema, ShippedSchema } from '../schemas'

class ShippedManager extends ArrayManager<ShippedItemSchema> {
  constructor() {
    super('shipped.json')
  }

  async getShipped(projectId: string): Promise<ShippedSchema> {
    return this.read(projectId)
  }

  async getRecentShipped(projectId: string, limit = 10): Promise<ShippedSchema> {
    const shipped = await this.read(projectId)
    return shipped
      .sort((a, b) => new Date(b.shippedAt).getTime() - new Date(a.shippedAt).getTime())
      .slice(0, limit)
  }

  async addShipped(
    projectId: string,
    item: Omit<ShippedItemSchema, 'id' | 'shippedAt'>
  ): Promise<ShippedSchema> {
    const shippedItem: ShippedItemSchema = {
      ...item,
      id: `shipped_${Date.now()}`,
      shippedAt: new Date().toISOString()
    }
    return this.add(projectId, shippedItem)
  }

  async getByFeature(projectId: string, featureId: string): Promise<ShippedSchema> {
    const shipped = await this.read(projectId)
    return shipped.filter((item) => item.featureId === featureId)
  }

  async getTotalDuration(projectId: string): Promise<string> {
    const shipped = await this.read(projectId)
    // Parse durations and sum (simplified - assumes format like "2h 30m")
    let totalMinutes = 0
    for (const item of shipped) {
      const hours = item.duration.match(/(\d+)h/)
      const minutes = item.duration.match(/(\d+)m/)
      if (hours) totalMinutes += parseInt(hours[1]) * 60
      if (minutes) totalMinutes += parseInt(minutes[1])
    }
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  async getCount(projectId: string): Promise<number> {
    const shipped = await this.read(projectId)
    return shipped.length
  }
}

export const shippedManager = new ShippedManager()
export default shippedManager
