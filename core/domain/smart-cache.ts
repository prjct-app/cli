/**
 * SmartCache - Intelligent Persistent Cache for Agents
 *
 * Cache with specific keys: {projectId}-{domain}-{techStack}
 * Persists to disk for cross-session caching
 * Invalidates only when stack changes
 *
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import log from '../utils/logger'

interface CacheStats {
  size: number
  keys: string[]
}

class SmartCache {
  projectId: string | null
  memoryCache: Map<string, unknown>
  cacheDir: string
  cacheFile: string

  constructor(projectId: string | null = null) {
    this.projectId = projectId
    this.memoryCache = new Map()
    this.cacheDir = path.join(os.homedir(), '.prjct-cli', 'cache')
    this.cacheFile = projectId
      ? path.join(this.cacheDir, `agents-${projectId}.json`)
      : path.join(this.cacheDir, 'agents-global.json')
  }

  /**
   * Initialize cache - load from disk
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
      await this.loadFromDisk()
    } catch {
      // Cache file doesn't exist yet - that's ok
      this.memoryCache = new Map()
    }
  }

  /**
   * Generate cache key
   * Format: {projectId}-{domain}-{techStackHash}
   */
  generateKey(projectId: string | null, domain: string, techStack: Record<string, unknown> = {}): string {
    const techString = JSON.stringify(techStack)
    const techHash = crypto.createHash('md5').update(techString).digest('hex').substring(0, 8)
    return `${projectId || 'global'}-${domain}-${techHash}`
  }

  /**
   * Get from cache
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    // Check memory first
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T
    }

    // Load from disk if not in memory
    await this.loadFromDisk()
    return (this.memoryCache.get(key) as T) || null
  }

  /**
   * Set in cache
   */
  async set(key: string, value: unknown): Promise<void> {
    // Set in memory
    this.memoryCache.set(key, value)

    // Persist to disk (async, don't wait)
    this.persistToDisk().catch((err) => {
      log.error('Cache persist error:', err.message)
    })
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    if (this.memoryCache.has(key)) {
      return true
    }

    await this.loadFromDisk()
    return this.memoryCache.has(key)
  }

  /**
   * Clear cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()
    try {
      await fs.unlink(this.cacheFile)
    } catch {
      // File doesn't exist - that's ok
    }
  }

  /**
   * Invalidate cache for a project (when stack changes)
   */
  async invalidateProject(projectId: string): Promise<void> {
    const keysToDelete: string[] = []
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`${projectId}-`)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach((key) => this.memoryCache.delete(key))
    await this.persistToDisk()
  }

  /**
   * Load cache from disk
   */
  async loadFromDisk(): Promise<void> {
    try {
      const content = await fs.readFile(this.cacheFile, 'utf-8')
      const data = JSON.parse(content) as Record<string, unknown>

      // Restore to memory cache
      for (const [key, value] of Object.entries(data)) {
        this.memoryCache.set(key, value)
      }
    } catch {
      // File doesn't exist or invalid - start fresh
      this.memoryCache = new Map()
    }
  }

  /**
   * Persist cache to disk
   */
  async persistToDisk(): Promise<void> {
    try {
      const data = Object.fromEntries(this.memoryCache)
      await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2), 'utf-8')
    } catch {
      // Fail silently - cache is best effort
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      size: this.memoryCache.size,
      keys: Array.from(this.memoryCache.keys()),
    }
  }
}

export default SmartCache
