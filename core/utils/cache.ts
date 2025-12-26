/**
 * Cache Utilities - Shared caching primitives for storage layers
 *
 * Provides two cache implementations:
 * - TTLCache: Time-based cache with LRU eviction (for StorageManager)
 * - LazyCache: Single-project lazy loading cache (for memory system)
 */

export interface CacheEntry<T> {
  data: T
  timestamp: number
}

export interface CacheOptions {
  /** TTL in milliseconds (default: 5000) */
  ttl?: number
  /** Max entries before eviction (default: 50) */
  maxSize?: number
}

export interface CacheStats {
  size: number
  maxSize: number
  ttl: number
}

/**
 * TTL Cache with LRU eviction
 *
 * Used by StorageManager for project-keyed caching.
 * Automatically evicts expired entries and oldest entries when over capacity.
 */
export class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private readonly ttl: number
  private readonly maxSize: number

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl ?? 5000
    this.maxSize = options.maxSize ?? 50
  }

  /**
   * Check if entry exists and is not expired
   */
  isValid(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    return Date.now() - entry.timestamp < this.ttl
  }

  /**
   * Get entry if valid, otherwise null
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) return null

    if (!this.isValid(key)) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Set entry with current timestamp
   */
  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() })
    this.evictOldEntries()
  }

  /**
   * Delete entry
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Check if key exists (may be expired)
   */
  has(key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * Get number of entries (including expired)
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Evict oldest entries if over max size
   */
  private evictOldEntries(): void {
    if (this.cache.size <= this.maxSize) return

    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    )

    const toRemove = entries.slice(0, this.cache.size - this.maxSize)
    for (const [key] of toRemove) {
      this.cache.delete(key)
    }
  }

  /**
   * Get cache statistics
   */
  stats(): CacheStats {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    }
  }

  /**
   * Remove all expired entries
   */
  prune(): number {
    let removed = 0
    for (const key of this.cache.keys()) {
      if (!this.isValid(key)) {
        this.cache.delete(key)
        removed++
      }
    }
    return removed
  }
}

/**
 * Single-project lazy cache
 *
 * Used by CachedStore for memory system (one project at a time).
 * Simpler than TTLCache - just tracks if data is loaded for current project.
 */
export class LazyCache<T> {
  private data: T | null = null
  private loaded = false
  private projectId: string | null = null

  /**
   * Check if loaded for a specific project
   */
  isLoaded(projectId?: string): boolean {
    if (projectId) {
      return this.loaded && this.projectId === projectId
    }
    return this.loaded
  }

  /**
   * Get cached data (may be null if not loaded)
   */
  get(): T | null {
    return this.data
  }

  /**
   * Set data for a project
   */
  set(projectId: string, data: T): void {
    this.data = data
    this.loaded = true
    this.projectId = projectId
  }

  /**
   * Reset cache
   */
  reset(): void {
    this.data = null
    this.loaded = false
    this.projectId = null
  }

  /**
   * Get current project ID
   */
  getProjectId(): string | null {
    return this.projectId
  }

  /**
   * Check if cache is empty
   */
  isEmpty(): boolean {
    return !this.loaded || this.data === null
  }
}

// Default export for CommonJS compatibility
export default {
  TTLCache,
  LazyCache,
}
