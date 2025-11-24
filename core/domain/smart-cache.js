/**
 * SmartCache - Intelligent Persistent Cache for Agents
 * 
 * Cache with specific keys: {projectId}-{domain}-{techStack}
 * Persists to disk for cross-session caching
 * Invalidates only when stack changes
 * 
 * @version 1.0.0
 */

const fs = require('fs').promises
const path = require('path')
const os = require('os')
const crypto = require('crypto')

class SmartCache {
  constructor(projectId = null) {
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
  async initialize() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
      await this.loadFromDisk()
    } catch (error) {
      // Cache file doesn't exist yet - that's ok
      this.memoryCache = new Map()
    }
  }

  /**
   * Generate cache key
   * Format: {projectId}-{domain}-{techStackHash}
   */
  generateKey(projectId, domain, techStack = {}) {
    const techString = JSON.stringify(techStack)
    const techHash = crypto.createHash('md5').update(techString).digest('hex').substring(0, 8)
    return `${projectId || 'global'}-${domain}-${techHash}`
  }

  /**
   * Get from cache
   */
  async get(key) {
    // Check memory first
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key)
    }

    // Load from disk if not in memory
    await this.loadFromDisk()
    return this.memoryCache.get(key) || null
  }

  /**
   * Set in cache
   */
  async set(key, value) {
    // Set in memory
    this.memoryCache.set(key, value)

    // Persist to disk (async, don't wait)
    this.persistToDisk().catch(err => {
      console.error('Cache persist error:', err.message)
    })
  }

  /**
   * Check if key exists
   */
  async has(key) {
    if (this.memoryCache.has(key)) {
      return true
    }

    await this.loadFromDisk()
    return this.memoryCache.has(key)
  }

  /**
   * Clear cache
   */
  async clear() {
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
  async invalidateProject(projectId) {
    const keysToDelete = []
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`${projectId}-`)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.memoryCache.delete(key))
    await this.persistToDisk()
  }

  /**
   * Load cache from disk
   */
  async loadFromDisk() {
    try {
      const content = await fs.readFile(this.cacheFile, 'utf-8')
      const data = JSON.parse(content)
      
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
  async persistToDisk() {
    try {
      const data = Object.fromEntries(this.memoryCache)
      await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
      // Fail silently - cache is best effort
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.memoryCache.size,
      keys: Array.from(this.memoryCache.keys())
    }
  }
}

module.exports = SmartCache

