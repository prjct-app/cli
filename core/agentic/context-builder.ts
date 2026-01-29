/**
 * Context Builder
 * Builds project context for Claude with smart caching.
 *
 * @module agentic/context-builder
 * @version 0.1
 */

import fs from 'node:fs/promises'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import type { ContextPaths, ContextState, ProjectContext } from '../types'
import { isNotFoundError } from '../types/fs'

// Re-export types for convenience
export type { ContextPaths, ContextState, ProjectContext } from '../types'

// Local type aliases for backward compatibility
type Paths = ContextPaths
type Context = ProjectContext
type State = ContextState

/**
 * Builds and caches project context for Claude decisions.
 * Features parallel reads, selective loading, and anti-hallucination mtime checks.
 */
class ContextBuilder {
  private _cache: Map<string, string | null>
  private _cacheTimeout: number
  private _lastCacheTime: number | null
  private _mtimes: Map<string, number>

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
   */
  private _clearCacheIfStale(force: boolean = false): void {
    if (force || !this._lastCacheTime || Date.now() - this._lastCacheTime > this._cacheTimeout) {
      this._cache.clear()
      this._lastCacheTime = Date.now()
    }
  }

  /**
   * Build full project context for Claude
   */
  async build(projectPath: string, commandParams: Record<string, unknown> = {}): Promise<Context> {
    const projectId = await configManager.getProjectId(projectPath)
    const globalPath = pathManager.getGlobalProjectPath(projectId!)

    return {
      // Project identification
      projectId,
      projectPath,
      globalPath,

      // File paths
      paths: {
        now: pathManager.getFilePath(projectId!, 'core', 'now.md'),
        next: pathManager.getFilePath(projectId!, 'core', 'next.md'),
        context: pathManager.getFilePath(projectId!, 'core', 'context.md'),
        shipped: pathManager.getFilePath(projectId!, 'progress', 'shipped.md'),
        metrics: pathManager.getFilePath(projectId!, 'progress', 'metrics.md'),
        ideas: pathManager.getFilePath(projectId!, 'planning', 'ideas.md'),
        roadmap: pathManager.getFilePath(projectId!, 'planning', 'roadmap.md'),
        specs: pathManager.getFilePath(projectId!, 'planning', 'specs'),
        memory: pathManager.getFilePath(projectId!, 'memory', 'context.jsonl'),
        patterns: pathManager.getFilePath(projectId!, 'memory', 'patterns.json'),
        analysis: pathManager.getFilePath(projectId!, 'analysis', 'repo-summary.md'),
        codePatterns: pathManager.getFilePath(projectId!, 'analysis', 'patterns.md'),
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
   */
  async loadState(context: Context, onlyKeys: string[] | null = null): Promise<State> {
    this._clearCacheIfStale()

    const state: State = {}
    const entries = Object.entries(context.paths)

    // Filter to only requested keys if specified
    const filteredEntries = onlyKeys ? entries.filter(([key]) => onlyKeys.includes(key)) : entries

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
        } catch (error) {
          // File doesn't exist or access error - invalidate cache
          if (isNotFoundError(error)) {
            this._cache.delete(filePath)
            this._mtimes.delete(filePath)
          } else {
            throw error
          }
        }
      }
    }

    // Separate cached vs uncached files
    const uncachedEntries: [string, string][] = []
    for (const [key, filePath] of filteredEntries) {
      if (this._cache.has(filePath)) {
        state[key] = this._cache.get(filePath)!
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
            fs.stat(filePath),
          ])
          return { key, filePath, content, mtime: stat.mtimeMs }
        } catch (error) {
          if (isNotFoundError(error)) {
            return { key, filePath, content: null, mtime: null }
          }
          throw error
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
   */
  async loadStateForCommand(context: Context, commandName: string): Promise<State> {
    // Command-specific file requirements
    // Minimizes context window usage
    // CRITICAL: Include 'codePatterns' for ALL code-modifying commands
    const commandFileMap: Record<string, string[]> = {
      // Core workflow
      now: ['now', 'next', 'analysis', 'codePatterns'],
      done: ['now', 'next', 'metrics', 'analysis'],
      next: ['next', 'analysis'],

      // Progress
      ship: ['now', 'shipped', 'metrics', 'analysis'],
      recap: ['shipped', 'metrics', 'now', 'analysis'],
      progress: ['shipped', 'metrics', 'analysis'],

      // Planning
      idea: ['ideas', 'next', 'analysis'],
      feature: ['roadmap', 'next', 'ideas', 'analysis', 'codePatterns'],
      roadmap: ['roadmap', 'analysis'],
      spec: ['roadmap', 'next', 'specs', 'analysis', 'codePatterns'],

      // Analysis
      analyze: ['analysis', 'context', 'codePatterns'],
      sync: ['analysis', 'context', 'now', 'codePatterns'],

      // Code modification commands - ALWAYS need codePatterns
      work: ['now', 'next', 'analysis', 'context', 'codePatterns'],
      build: ['now', 'next', 'analysis', 'context', 'codePatterns'],
      design: ['analysis', 'context', 'codePatterns'],
      cleanup: ['analysis', 'context', 'codePatterns'],
      fix: ['analysis', 'context', 'codePatterns'],
      test: ['analysis', 'context', 'codePatterns'],

      // All files (fallback) - include codePatterns for any code work
      default: ['analysis', 'codePatterns'],
    }

    const requiredFiles = commandFileMap[commandName] || commandFileMap.default
    return this.loadState(context, requiredFiles)
  }

  /**
   * Batch read multiple files in parallel
   * Utility for custom file sets
   */
  async batchRead(filePaths: string[]): Promise<Map<string, string | null>> {
    this._clearCacheIfStale()

    const results = new Map<string, string | null>()
    const uncachedPaths: string[] = []

    // Check cache first
    for (const filePath of filePaths) {
      if (this._cache.has(filePath)) {
        results.set(filePath, this._cache.get(filePath)!)
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
        } catch (error) {
          if (isNotFoundError(error)) {
            return { filePath, content: null }
          }
          throw error
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
   */
  invalidateCache(filePath: string): void {
    this._cache.delete(filePath)
  }

  /**
   * Force clear entire cache
   */
  clearCache(): void {
    this._clearCacheIfStale(true)
  }

  /**
   * Check file existence
   */
  async fileExists(filePath: string): Promise<boolean> {
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
   * Get cache stats (for debugging/metrics)
   */
  getCacheStats(): { size: number; lastRefresh: number | null; timeout: number } {
    return {
      size: this._cache.size,
      lastRefresh: this._lastCacheTime,
      timeout: this._cacheTimeout,
    }
  }
}

const contextBuilder = new ContextBuilder()
export default contextBuilder
export { ContextBuilder }
