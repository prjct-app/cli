/**
 * Storage Manager Base Class
 *
 * Write-through pattern:
 * 1. Write JSON to storage/
 * 2. Regenerate MD in context/
 * 3. Publish event for backend sync
 *
 * Subclasses implement specific data types (state, queue, ideas, shipped).
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { eventBus, type SyncEvent } from '../events'
import pathManager from '../infrastructure/path-manager'
import { isNotFoundError } from '../types/fs'
import { TTLCache } from '../utils/cache'
import { getTimestamp } from '../utils/date-helper'

export abstract class StorageManager<T> {
  protected filename: string
  protected cache: TTLCache<T>

  constructor(filename: string) {
    this.filename = filename
    this.cache = new TTLCache<T>({ ttl: 5000, maxSize: 50 })
  }

  /**
   * Get file path for storage JSON
   */
  protected getStoragePath(projectId: string): string {
    return pathManager.getStoragePath(projectId, this.filename)
  }

  /**
   * Get file path for context MD
   * Uses layer-based paths to match MdBaseManager structure
   */
  protected getContextPath(projectId: string, mdFilename: string): string {
    const layer = this.getLayer()
    return pathManager.getFilePath(projectId, layer, mdFilename)
  }

  /**
   * Get the layer for context MD files
   * Override in subclasses: 'core' | 'planning' | 'progress'
   */
  protected abstract getLayer(): string

  /**
   * Get default data structure
   */
  protected abstract getDefault(): T

  /**
   * Convert data to markdown for Claude
   */
  protected abstract toMarkdown(data: T): string

  /**
   * Get MD filename for context generation
   */
  protected abstract getMdFilename(): string

  /**
   * Get event type for sync
   */
  protected abstract getEventType(action: 'update' | 'create' | 'delete'): string

  /**
   * Read data from storage
   */
  async read(projectId: string): Promise<T> {
    // Check cache first (with expiration)
    const cached = this.cache.get(projectId)
    if (cached !== null) {
      return cached
    }

    const filePath = this.getStoragePath(projectId)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content) as T
      this.cache.set(projectId, data)
      return data
    } catch (error) {
      // Return default if file doesn't exist or is invalid JSON
      if (isNotFoundError(error) || error instanceof SyntaxError) {
        return this.getDefault()
      }
      throw error
    }
  }

  /**
   * Write data to storage + regenerate context + publish event
   */
  async write(projectId: string, data: T): Promise<void> {
    const storagePath = this.getStoragePath(projectId)
    const contextPath = this.getContextPath(projectId, this.getMdFilename())

    // Ensure directories exist
    await fs.mkdir(path.dirname(storagePath), { recursive: true })
    await fs.mkdir(path.dirname(contextPath), { recursive: true })

    // 1. Write JSON (atomic via temp file)
    const tempPath = `${storagePath}.${Date.now()}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tempPath, storagePath)

    // 2. Regenerate MD for Claude
    const md = this.toMarkdown(data)
    await fs.writeFile(contextPath, md, 'utf-8')

    // 3. Update cache
    this.cache.set(projectId, data)

    // 4. Publish event for backend sync (NOT included in this call - subclass handles)
  }

  /**
   * Update data with a transform function
   */
  async update(projectId: string, updater: (current: T) => T): Promise<T> {
    const current = await this.read(projectId)
    const updated = updater(current)
    await this.write(projectId, updated)
    return updated
  }

  /**
   * Publish sync event to eventBus
   */
  protected async publishEvent(
    projectId: string,
    eventType: string,
    eventData: unknown
  ): Promise<void> {
    const event: SyncEvent = {
      type: eventType,
      path: [this.filename.replace('.json', '')],
      data: eventData,
      timestamp: getTimestamp(),
      projectId,
    }

    await eventBus.publish(event)
  }

  /**
   * Publish an entity event with automatic type construction
   * Convenience method that builds event type from entity and action
   *
   * @param projectId - Project identifier
   * @param entity - Entity name (e.g., 'task', 'idea', 'queue', 'feature')
   * @param action - Action name (e.g., 'started', 'completed', 'created')
   * @param payload - Event data (timestamp added automatically)
   */
  protected async publishEntityEvent(
    projectId: string,
    entity: string,
    action: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const eventType = `${entity}.${action}`
    const eventData = {
      ...payload,
      timestamp: getTimestamp(),
    }

    await this.publishEvent(projectId, eventType, eventData)
  }

  /**
   * Check if storage file exists
   */
  async exists(projectId: string): Promise<boolean> {
    const filePath = this.getStoragePath(projectId)
    try {
      await fs.access(filePath)
      return true
    } catch (error) {
      if (isNotFoundError(error)) {
        return false
      }
      throw error
    }
  }

  /**
   * Clear cache for a project
   */
  clearCache(projectId?: string): void {
    if (projectId) {
      this.cache.delete(projectId)
    } else {
      this.cache.clear()
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttl: number } {
    return this.cache.stats()
  }
}

export default StorageManager
