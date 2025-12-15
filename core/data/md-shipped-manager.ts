/**
 * MD Shipped Manager
 *
 * MD-First Architecture: Manages shipped features via shipped.md.
 * Source of truth is the markdown file, not JSON.
 */

import { MdArrayManager } from './md-base-manager'
import { parseShipped, serializeShipped, type ShippedFeature } from '../serializers/shipped-serializer'
import { generateUUID } from '../schemas'

class MdShippedManager extends MdArrayManager<ShippedFeature> {
  constructor() {
    super('progress/shipped.md')
  }

  protected parse(content: string): ShippedFeature[] {
    return parseShipped(content)
  }

  protected serialize(data: ShippedFeature[]): string {
    return serializeShipped(data)
  }

  // =========== Shipped Features ===========

  /**
   * Add a shipped feature
   */
  async addShipped(
    projectId: string,
    feature: Omit<ShippedFeature, 'id' | 'shippedAt'>
  ): Promise<ShippedFeature[]> {
    const shippedFeature: ShippedFeature = {
      ...feature,
      id: generateUUID(),
      shippedAt: new Date().toISOString()
    }

    return this.prepend(projectId, shippedFeature)
  }

  /**
   * Get all shipped features
   */
  async getAll(projectId: string): Promise<ShippedFeature[]> {
    return this.read(projectId)
  }

  /**
   * Get recent shipped features (last N)
   */
  async getRecent(projectId: string, limit: number = 5): Promise<ShippedFeature[]> {
    const all = await this.read(projectId)
    return all.slice(0, limit)
  }

  /**
   * Get shipped features by version
   */
  async getByVersion(projectId: string, version: string): Promise<ShippedFeature | undefined> {
    return this.find(projectId, (f) => f.version === version)
  }

  /**
   * Get shipped features count
   */
  async getCount(projectId: string): Promise<number> {
    const all = await this.read(projectId)
    return all.length
  }

  /**
   * Get shipped features for a date range
   */
  async getByDateRange(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ShippedFeature[]> {
    const all = await this.read(projectId)
    return all.filter((f) => {
      const date = new Date(f.shippedAt)
      return date >= startDate && date <= endDate
    })
  }
}

export const mdShippedManager = new MdShippedManager()
export default mdShippedManager
