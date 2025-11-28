/**
 * Context Builder
 * Builds project context for Claude to make decisions
 * NO if/else logic - just data collection
 *
 * OPTIMIZATION (P0.1): Smart Context Caching
 * - Parallel file reads with Promise.all()
 * - Session-based caching to avoid redundant reads
 * - Selective loading based on command needs
 *
 * Source: Windsurf, Cursor patterns
 */

const fs = require('fs').promises
const pathManager = require('../infrastructure/path-manager')
const configManager = require('../infrastructure/config-manager')

class ContextBuilder {
  constructor() {
    // Session cache - cleared between commands or after timeout
    this._cache = new Map()
    // ANTI-HALLUCINATION: Reduced from 30s to 5s to prevent stale data
    this._cacheTimeout = 5000 // 5 seconds (was 30s - caused stale context issues)
    this._lastCacheTime = null
    // Track file modification times for additional staleness detection
    this._mtimes = new Map()
  }

  /**
   * Clear cache if stale or force clear
   * @param {boolean} force - Force clear regardless of timeout
   */
  _clearCacheIfStale(force = false) {
    if (force || !this._lastCacheTime ||
        Date.now() - this._lastCacheTime > this._cacheTimeout) {
      this._cache.clear()
      this._lastCacheTime = Date.now()
    }
  }

  /**
   * Build full project context for Claude
   * @param {string} projectPath - Local project path
   * @param {Object} commandParams - Command-specific parameters
   * @returns {Promise<Object>} Context object
   */
  async build(projectPath, commandParams = {}) {
    const projectId = await configManager.getProjectId(projectPath)
    const globalPath = pathManager.getGlobalProjectPath(projectId)

    return {
      // Project identification
      projectId,
      projectPath,
      globalPath,

      // File paths
      paths: {
        now: pathManager.getFilePath(projectId, 'core', 'now.md'),
        next: pathManager.getFilePath(projectId, 'core', 'next.md'),
        context: pathManager.getFilePath(projectId, 'core', 'context.md'),
        shipped: pathManager.getFilePath(projectId, 'progress', 'shipped.md'),
        metrics: pathManager.getFilePath(projectId, 'progress', 'metrics.md'),
        ideas: pathManager.getFilePath(projectId, 'planning', 'ideas.md'),
        roadmap: pathManager.getFilePath(projectId, 'planning', 'roadmap.md'),
        specs: pathManager.getFilePath(projectId, 'planning', 'specs'),
        memory: pathManager.getFilePath(projectId, 'memory', 'context.jsonl'),
        patterns: pathManager.getFilePath(projectId, 'memory', 'patterns.json'),
        analysis: pathManager.getFilePath(projectId, 'analysis', 'repo-summary.md'),
      },

      // Command parameters
      params: commandParams,

      // System timestamps (ALWAYS use these, NEVER generate timestamps)
      // LLM does not know current date/time - these are from system clock
      timestamp: new Date().toISOString(), // ISO format: "2025-10-07T14:30:00.000Z"
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD: "2025-10-07"
    }
  }

  /**
   * Load current project state - PARALLEL VERSION
   * Uses Promise.all() for 40-60% faster file I/O
   *
   * @param {Object} context - Context from build()
   * @param {string[]} onlyKeys - Optional: only load specific keys (selective loading)
   * @returns {Promise<Object>} Current state
   */
  async loadState(context, onlyKeys = null) {
    this._clearCacheIfStale()

    const state = {}
    const entries = Object.entries(context.paths)

    // Filter to only requested keys if specified
    const filteredEntries = onlyKeys
      ? entries.filter(([key]) => onlyKeys.includes(key))
      : entries

    // ANTI-HALLUCINATION: Verify mtime before trusting cache
    // Files can change between commands - stale cache causes hallucinations
    for (const [, filePath] of filteredEntries) {
      if (this._cache.has(filePath)) {
        try {
          const stat = await fs.stat(filePath)
          const cachedMtime = this._mtimes.get(filePath)
          if (!cachedMtime || stat.mtimeMs > cachedMtime) {
            // File changed since cached - invalidate
            this._cache.delete(filePath)
            this._mtimes.delete(filePath)
          }
        } catch {
          // File doesn't exist - invalidate cache
          this._cache.delete(filePath)
          this._mtimes.delete(filePath)
        }
      }
    }

    // Separate cached vs uncached files
    const uncachedEntries = []
    for (const [key, filePath] of filteredEntries) {
      if (this._cache.has(filePath)) {
        state[key] = this._cache.get(filePath)
      } else {
        uncachedEntries.push([key, filePath])
      }
    }

    // PARALLEL READ: All uncached files at once
    if (uncachedEntries.length > 0) {
      const readPromises = uncachedEntries.map(async ([key, filePath]) => {
        try {
          const [content, stat] = await Promise.all([
            fs.readFile(filePath, 'utf-8'),
            fs.stat(filePath)
          ])
          return { key, filePath, content, mtime: stat.mtimeMs }
        } catch {
          return { key, filePath, content: null, mtime: null }
        }
      })

      const results = await Promise.all(readPromises)

      // Populate state and cache (with mtime for anti-hallucination)
      for (const { key, filePath, content, mtime } of results) {
        state[key] = content
        this._cache.set(filePath, content)
        if (mtime) {
          this._mtimes.set(filePath, mtime)
        }
      }
    }

    return state
  }

  /**
   * Load state for specific command - optimized selective loading
   * Each command only loads what it needs
   *
   * @param {Object} context - Context from build()
   * @param {string} commandName - Command name for selective loading
   * @returns {Promise<Object>} Current state (filtered)
   */
  async loadStateForCommand(context, commandName) {
    // Command-specific file requirements
    // Minimizes context window usage
    // CRITICAL: Always include 'analysis' for pattern detection
    const commandFileMap = {
      // Core workflow
      'now': ['now', 'next', 'analysis'],
      'done': ['now', 'next', 'metrics', 'analysis'],
      'next': ['next', 'analysis'],

      // Progress
      'ship': ['now', 'shipped', 'metrics', 'analysis'],
      'recap': ['shipped', 'metrics', 'now', 'analysis'],
      'progress': ['shipped', 'metrics', 'analysis'],

      // Planning
      'idea': ['ideas', 'next', 'analysis'],
      'feature': ['roadmap', 'next', 'ideas', 'analysis'],
      'roadmap': ['roadmap', 'analysis'],
      'spec': ['roadmap', 'next', 'specs', 'analysis'],

      // Analysis
      'analyze': ['analysis', 'context'],
      'sync': ['analysis', 'context', 'now'],

      // Code modification commands - ALWAYS need analysis for patterns
      'work': ['now', 'next', 'analysis', 'context'],
      'build': ['now', 'next', 'analysis', 'context'],
      'design': ['analysis', 'context'],
      'cleanup': ['analysis', 'context'],
      'fix': ['analysis', 'context'],
      'test': ['analysis', 'context'],

      // All files (fallback)
      'default': ['analysis'] // Always include analysis even for unknown commands
    }

    const requiredFiles = commandFileMap[commandName] || commandFileMap.default
    return this.loadState(context, requiredFiles)
  }

  /**
   * Batch read multiple files in parallel
   * Utility for custom file sets
   *
   * @param {string[]} filePaths - Array of file paths
   * @returns {Promise<Map<string, string|null>>} Map of path -> content
   */
  async batchRead(filePaths) {
    this._clearCacheIfStale()

    const results = new Map()
    const uncachedPaths = []

    // Check cache first
    for (const filePath of filePaths) {
      if (this._cache.has(filePath)) {
        results.set(filePath, this._cache.get(filePath))
      } else {
        uncachedPaths.push(filePath)
      }
    }

    // Parallel read uncached
    if (uncachedPaths.length > 0) {
      const readPromises = uncachedPaths.map(async (filePath) => {
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          return { filePath, content }
        } catch {
          return { filePath, content: null }
        }
      })

      const readResults = await Promise.all(readPromises)

      for (const { filePath, content } of readResults) {
        results.set(filePath, content)
        this._cache.set(filePath, content)
      }
    }

    return results
  }

  /**
   * Invalidate cache for specific file (after write)
   * @param {string} filePath - File that was written
   */
  invalidateCache(filePath) {
    this._cache.delete(filePath)
  }

  /**
   * Force clear entire cache
   */
  clearCache() {
    this._clearCacheIfStale(true)
  }

  /**
   * Check file existence
   * @param {string} filePath - File path
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get cache stats (for debugging/metrics)
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this._cache.size,
      lastRefresh: this._lastCacheTime,
      timeout: this._cacheTimeout
    }
  }
}

module.exports = new ContextBuilder()
