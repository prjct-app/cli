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
import type { ContextState } from '../types/agentic'
import type { ContextPaths, ProjectContext } from '../types/core'
import { isNotFoundError } from '../types/fs'
import { TTLCache } from '../utils/cache'

// Re-export types for convenience
export type { ContextState } from '../types/agentic'
export type { ContextPaths, ProjectContext } from '../types/core'

export type Paths = ContextPaths
export type Context = ProjectContext
export type State = ContextState

interface CachedFile {
  content: string | null
  mtime: number | null
}

/**
 * Builds and caches project context for Claude decisions.
 * Features parallel reads, selective loading, and anti-hallucination mtime checks.
 */
class ContextBuilder {
  private _cache: TTLCache<CachedFile>
  private _currentProjectId: string | null

  constructor() {
    this._cache = new TTLCache<CachedFile>({ ttl: 5000, maxSize: 200 })
    this._currentProjectId = null
  }

  /**
   * Build full project context for Claude
   */
  async build(projectPath: string, commandParams: Record<string, unknown> = {}): Promise<Context> {
    const projectId = await configManager.getProjectId(projectPath)
    const globalPath = pathManager.getGlobalProjectPath(projectId!)

    // Clear cache on project switch
    if (this._currentProjectId !== null && this._currentProjectId !== projectId) {
      this._cache.clear()
    }
    this._currentProjectId = projectId

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
    const state: State = {}
    const entries = Object.entries(context.paths)

    // Filter to only requested keys if specified
    const filteredEntries = onlyKeys ? entries.filter(([key]) => onlyKeys.includes(key)) : entries

    // ANTI-HALLUCINATION: Verify mtime before trusting cache
    // Files can change between commands - stale cache causes hallucinations
    for (const [, filePath] of filteredEntries) {
      const cachedEntry = this._cache.get(filePath)
      if (cachedEntry !== null) {
        try {
          const stat = await fs.stat(filePath)
          if (!cachedEntry.mtime || stat.mtimeMs > cachedEntry.mtime) {
            this._cache.delete(filePath)
          }
        } catch (error) {
          if (isNotFoundError(error)) {
            this._cache.delete(filePath)
          } else {
            throw error
          }
        }
      }
    }

    // Separate cached vs uncached files
    const uncachedEntries: [string, string][] = []
    for (const [key, filePath] of filteredEntries) {
      const cachedEntry = this._cache.get(filePath)
      if (cachedEntry !== null) {
        state[key] = cachedEntry.content
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

      for (const { key, filePath, content, mtime } of results) {
        state[key] = content
        this._cache.set(filePath, { content, mtime })
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
    const results = new Map<string, string | null>()
    const uncachedPaths: string[] = []

    // Check cache first
    for (const filePath of filePaths) {
      const cachedEntry = this._cache.get(filePath)
      if (cachedEntry !== null) {
        results.set(filePath, cachedEntry.content)
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
        this._cache.set(filePath, { content, mtime: null })
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
    this._cache.clear()
    this._currentProjectId = null
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
  getCacheStats(): { size: number; maxSize: number; ttl: number } {
    return this._cache.stats()
  }
}

const contextBuilder = new ContextBuilder()
export default contextBuilder
export { ContextBuilder }
