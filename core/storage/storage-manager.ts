/**
 * Storage Manager Base Class (PRJ-303: SQLite-backed)
 *
 * Write-through pattern:
 * 1. Write to SQLite kv_store (primary)
 * 2. Regenerate MD in context/
 * 3. Publish event for backend sync
 *
 * Read path: cache → SQLite → default
 *
 * Subclasses implement specific data types (state, queue, ideas, shipped).
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { eventBus, type SyncEvent } from '../events'
import pathManager from '../infrastructure/path-manager'
import { TTLCache } from '../utils/cache'
import { getTimestamp } from '../utils/date-helper'
import { prjctDb } from './database'

export abstract class StorageManager<T> {
  protected filename: string
  protected cache: TTLCache<T>

  constructor(filename: string, _schema?: unknown) {
    this.filename = filename
    this.cache = new TTLCache<T>({ ttl: 5000, maxSize: 50 })
  }

  /**
   * Get the kv_store key for this storage type.
   * Derived from filename: 'state.json' → 'state'
   */
  protected getStoreKey(): string {
    return this.filename.replace('.json', '')
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
   * Read data from storage.
   * Path: cache → SQLite kv_store → default
   */
  async read(projectId: string): Promise<T> {
    // Check cache first (with expiration)
    const cached = this.cache.get(projectId)
    if (cached !== null) {
      return cached
    }

    // Try SQLite kv_store (primary store)
    try {
      const data = prjctDb.getDoc<T>(projectId, this.getStoreKey())
      if (data !== null) {
        this.cache.set(projectId, data)
        return data
      }
    } catch {
      // SQLite not available (e.g., DB dir doesn't exist yet)
    }

    return this.getDefault()
  }

  /**
   * Write data to storage + regenerate context + publish event.
   * SQLite primary + MD context regeneration.
   */
  async write(projectId: string, data: T): Promise<void> {
    const contextPath = this.getContextPath(projectId, this.getMdFilename())

    // Ensure context directory exists
    await fs.mkdir(path.dirname(contextPath), { recursive: true })

    // 1. Write to SQLite kv_store (primary)
    prjctDb.setDoc(projectId, this.getStoreKey(), data)

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
   * Check if storage exists for this project.
   */
  async exists(projectId: string): Promise<boolean> {
    try {
      return prjctDb.hasDoc(projectId, this.getStoreKey())
    } catch {
      return false
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
