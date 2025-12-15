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

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { eventBus, type SyncEvent } from '../events'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export abstract class StorageManager<T> {
  protected filename: string
  protected cache: Map<string, CacheEntry<T>> = new Map()
  protected cacheTimeout = 5000 // 5 seconds
  protected maxCacheSize = 50 // Max projects to cache

  constructor(filename: string) {
    this.filename = filename
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < this.cacheTimeout
  }

  /**
   * Evict oldest entries if cache exceeds max size
   */
  private evictOldEntries(): void {
    if (this.cache.size <= this.maxCacheSize) return

    // Sort by timestamp and remove oldest
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)

    const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize)
    for (const [key] of toRemove) {
      this.cache.delete(key)
    }
  }

  /**
   * Get file path for storage JSON
   */
  protected getStoragePath(projectId: string): string {
    return path.join(
      os.homedir(),
      '.prjct-cli/projects',
      projectId,
      'storage',
      this.filename
    )
  }

  /**
   * Get file path for context MD
   */
  protected getContextPath(projectId: string, mdFilename: string): string {
    return path.join(
      os.homedir(),
      '.prjct-cli/projects',
      projectId,
      'context',
      mdFilename
    )
  }

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
    if (cached && this.isCacheValid(cached)) {
      return cached.data
    }

    // Remove expired entry
    if (cached) {
      this.cache.delete(projectId)
    }

    const filePath = this.getStoragePath(projectId)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content) as T
      this.cache.set(projectId, { data, timestamp: Date.now() })
      this.evictOldEntries()
      return data
    } catch {
      // Return default if file doesn't exist
      return this.getDefault()
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

    // 3. Update cache with timestamp
    this.cache.set(projectId, { data, timestamp: Date.now() })
    this.evictOldEntries()

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
      timestamp: new Date().toISOString(),
      projectId
    }

    await eventBus.publish(event)
  }

  /**
   * Check if storage file exists
   */
  async exists(projectId: string): Promise<boolean> {
    const filePath = this.getStoragePath(projectId)
    try {
      await fs.access(filePath)
      return true
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
}

export default StorageManager
