/**
 * Memory Stores - Base class, Session, History, and Domain Mapping
 *
 * Contains the foundational building blocks of the memory system:
 * - CachedStore<T> abstract base class for disk-backed stores
 * - SessionStore (Tier 1) - ephemeral, single command context
 * - HistoryStore (Tier 3) - append-only JSONL audit log
 * - Domain tag mapping and semantic domain resolution
 *
 * @module agentic/memory-stores
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import { isNotFoundError } from '../types/fs'
import type { HistoryEntry, HistoryEventType, KnownDomain, MemoryTag } from '../types/memory'
import { KNOWN_DOMAINS, MEMORY_TAGS } from '../types/memory'
import { getTimestamp, getTodayKey } from '../utils/date-helper'
import { ensureDir } from '../utils/file-helper'
import { appendJsonLine, getLastJsonLines } from '../utils/jsonl-helper'

// =============================================================================
// Semantic Domain Mapping (PRJ-300)
// =============================================================================

/**
 * Map each known domain to its relevant MEMORY_TAGS.
 * More comprehensive than the previous mapping — includes TECH_STACK and
 * DEPENDENCIES where they apply.
 */
export const DOMAIN_TAG_MAP: Record<string, MemoryTag[]> = {
  frontend: [
    MEMORY_TAGS.CODE_STYLE,
    MEMORY_TAGS.FILE_STRUCTURE,
    MEMORY_TAGS.ARCHITECTURE,
    MEMORY_TAGS.TECH_STACK,
  ],
  backend: [
    MEMORY_TAGS.CODE_STYLE,
    MEMORY_TAGS.ARCHITECTURE,
    MEMORY_TAGS.DEPENDENCIES,
    MEMORY_TAGS.TECH_STACK,
  ],
  devops: [
    MEMORY_TAGS.SHIP_WORKFLOW,
    MEMORY_TAGS.TEST_BEHAVIOR,
    MEMORY_TAGS.DEPENDENCIES,
    MEMORY_TAGS.ARCHITECTURE,
  ],
  docs: [MEMORY_TAGS.CODE_STYLE, MEMORY_TAGS.NAMING_CONVENTION, MEMORY_TAGS.FILE_STRUCTURE],
  testing: [MEMORY_TAGS.TEST_BEHAVIOR, MEMORY_TAGS.CODE_STYLE, MEMORY_TAGS.DEPENDENCIES],
  database: [
    MEMORY_TAGS.ARCHITECTURE,
    MEMORY_TAGS.NAMING_CONVENTION,
    MEMORY_TAGS.TECH_STACK,
    MEMORY_TAGS.DEPENDENCIES,
  ],
  general: Object.values(MEMORY_TAGS) as MemoryTag[],
}

/**
 * Semantic keywords for each domain.
 * Used to resolve unknown domain strings (e.g., "uxui" -> frontend)
 * and for partial scoring when memory tags relate semantically.
 * @see PRJ-300
 */
export const SEMANTIC_DOMAIN_KEYWORDS: Record<string, string[]> = {
  frontend: [
    'ui',
    'ux',
    'uxui',
    'css',
    'styling',
    'component',
    'layout',
    'design',
    'responsive',
    'react',
    'vue',
    'svelte',
    'angular',
    'html',
    'tailwind',
    'sass',
    'web',
    'accessibility',
    'a11y',
  ],
  backend: [
    'api',
    'server',
    'route',
    'endpoint',
    'rest',
    'graphql',
    'middleware',
    'worker',
    'queue',
    'auth',
    'hono',
    'express',
    'service',
    'microservice',
  ],
  devops: [
    'ci',
    'cd',
    'docker',
    'kubernetes',
    'deploy',
    'infra',
    'infrastructure',
    'monitoring',
    'cloud',
    'aws',
    'gcp',
    'azure',
    'pipeline',
    'helm',
    'terraform',
  ],
  docs: ['documentation', 'readme', 'guide', 'tutorial', 'wiki', 'changelog', 'jsdoc', 'typedoc'],
  testing: [
    'test',
    'spec',
    'e2e',
    'unit',
    'integration',
    'coverage',
    'mock',
    'vitest',
    'jest',
    'playwright',
    'cypress',
  ],
  database: [
    'db',
    'sql',
    'schema',
    'migration',
    'query',
    'orm',
    'prisma',
    'mongo',
    'postgres',
    'redis',
    'drizzle',
    'sqlite',
  ],
  general: [],
}

/**
 * Resolve a domain string to canonical known domain(s).
 * Known domains pass through; unknown domains are matched via semantic keywords.
 * Exported for testing.
 * @see PRJ-300
 */
export function resolveCanonicalDomains(domain: string): KnownDomain[] {
  // Exact match
  if ((KNOWN_DOMAINS as readonly string[]).includes(domain)) {
    return [domain as KnownDomain]
  }

  // Semantic resolution — find canonical domains whose keywords match
  const normalized = domain.toLowerCase().replace(/[-_\s]/g, '')
  const matches: KnownDomain[] = []

  for (const [canonical, keywords] of Object.entries(SEMANTIC_DOMAIN_KEYWORDS)) {
    if (canonical === 'general') continue
    for (const kw of keywords) {
      if (normalized.includes(kw) || kw.includes(normalized)) {
        matches.push(canonical as KnownDomain)
        break
      }
    }
  }

  return matches.length > 0 ? matches : ['general']
}

// =============================================================================
// Base Store
// =============================================================================

/**
 * Abstract base class for project-scoped, disk-backed stores with in-memory caching.
 *
 * Provides lazy loading, automatic directory creation on save, and project-scoped
 * cache invalidation. Subclasses only need to define the filename, default data
 * structure, and optionally a subdirectory or post-load normalization hook.
 *
 * Extended by {@link PatternStore} and {@link SemanticMemories}.
 *
 * @typeParam T - The shape of the stored data (e.g., `Patterns`, `MemoryDatabase`)
 *
 * @example
 * ```ts
 * class MyStore extends CachedStore<MyData> {
 *   protected getFilename() { return 'my-data.json' }
 *   protected getDefault() { return { items: [] } }
 * }
 *
 * const store = new MyStore()
 * const data = await store.load('project-id')
 * ```
 */
export abstract class CachedStore<T> {
  private _data: T | null = null
  private _loaded: boolean = false
  private _projectId: string | null = null

  /**
   * Return the filename for this store (e.g., `'patterns.json'`).
   * @returns The JSON filename used for disk persistence
   */
  protected abstract getFilename(): string

  /**
   * Return the default data structure when the file does not exist on disk.
   * @returns A fresh default instance of `T`
   */
  protected abstract getDefault(): T

  /**
   * Optional subdirectory within the project's `memory/` folder.
   * Override to nest the store file under a subfolder.
   *
   * @returns Subdirectory name, or `null` to store directly in `memory/`
   */
  protected getSubdirectory(): string | null {
    return null
  }

  /**
   * Build the full filesystem path for this store's JSON file.
   *
   * @param projectId - The project identifier used for path resolution
   * @returns Absolute path to the store file
   *   (e.g., `~/.prjct-cli/projects/{id}/memory/patterns.json`)
   */
  protected getPath(projectId: string): string {
    const basePath = path.join(pathManager.getGlobalProjectPath(projectId), 'memory')

    const subdir = this.getSubdirectory()
    if (subdir) {
      return path.join(basePath, subdir, this.getFilename())
    }

    return path.join(basePath, this.getFilename())
  }

  /**
   * Load data from disk with project-scoped caching.
   *
   * Returns cached data immediately if already loaded for the same project.
   * Otherwise reads from disk, falling back to {@link getDefault} when the
   * file does not exist. Calls {@link afterLoad} after a successful disk read.
   *
   * @param projectId - The project identifier
   * @returns The loaded (or cached) data
   * @throws {Error} If the file read fails for reasons other than ENOENT
   *
   * @example
   * ```ts
   * const patterns = await patternStore.load('my-project-id')
   * ```
   */
  async load(projectId: string): Promise<T> {
    // Return cached if same project and loaded
    if (this._loaded && this._data && this._projectId === projectId) {
      return this._data
    }

    // Load from disk
    const filePath = this.getPath(projectId)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      this._data = JSON.parse(content) as T
      // Allow subclasses to normalize data after load
      this.afterLoad(this._data)
    } catch (error) {
      if (isNotFoundError(error)) {
        this._data = this.getDefault()
      } else {
        throw error
      }
    }

    this._loaded = true
    this._projectId = projectId

    return this._data
  }

  /**
   * Hook for subclasses to normalize or migrate data after loading from disk.
   *
   * Called once per disk read (not on cache hits). Override to ensure
   * structural invariants — e.g., adding missing index keys.
   *
   * @param _data - The freshly loaded data to normalize (mutate in place)
   */
  protected afterLoad(_data: T): void {
    // Override in subclass if needed
  }

  /**
   * Persist the current in-memory data to disk.
   *
   * Creates parent directories automatically if they don't exist.
   * No-op if no data has been loaded yet.
   *
   * @param projectId - The project identifier for path resolution
   * @throws {Error} If the file write fails
   */
  async save(projectId: string): Promise<void> {
    if (!this._data) return

    const filePath = this.getPath(projectId)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(this._data, null, 2), 'utf-8')
  }

  /**
   * Access the cached data without triggering a disk read.
   *
   * @returns The cached data, or `null` if nothing has been loaded
   */
  protected getData(): T | null {
    return this._data
  }

  /**
   * Replace the in-memory data directly. Does not persist to disk —
   * call {@link save} afterwards if persistence is needed.
   *
   * @param data - The new data to cache
   */
  protected setData(data: T): void {
    this._data = data
  }

  /**
   * Atomically load, transform, and save data in one operation.
   *
   * @param projectId - The project identifier
   * @param updater - Pure function that receives current data and returns updated data
   * @returns The updated data after saving
   * @throws {Error} If load or save fails
   *
   * @example
   * ```ts
   * await store.update('my-project', (data) => ({
   *   ...data,
   *   count: data.count + 1,
   * }))
   * ```
   */
  async update(projectId: string, updater: (data: T) => T): Promise<T> {
    const data = await this.load(projectId)
    const updated = updater(data)
    this._data = updated
    await this.save(projectId)
    return updated
  }

  /**
   * Check whether data has been loaded into the cache.
   *
   * @param projectId - If provided, checks that data is loaded for this specific project.
   *   If omitted, returns `true` if any project's data is cached.
   * @returns `true` if data is loaded (and matches the project, when specified)
   */
  isLoaded(projectId?: string): boolean {
    if (projectId) {
      return this._loaded && this._projectId === projectId
    }
    return this._loaded
  }

  /**
   * Clear the in-memory cache, forcing a fresh disk read on the next {@link load} call.
   * Does not delete or modify the file on disk.
   */
  reset(): void {
    this._data = null
    this._loaded = false
    this._projectId = null
  }
}

// =============================================================================
// Session Store (Tier 1)
// =============================================================================

/**
 * Session Memory - Tier 1
 * Ephemeral, single command context.
 */
export class SessionStore {
  private _sessionMemory: Map<string, { value: unknown; timestamp: number }> = new Map()

  setSession(key: string, value: unknown): void {
    this._sessionMemory.set(key, { value, timestamp: Date.now() })
  }

  getSession(key: string): unknown {
    const entry = this._sessionMemory.get(key)
    return entry?.value
  }

  clearSession(): void {
    this._sessionMemory.clear()
  }
}

// =============================================================================
// History Store (Tier 3)
// =============================================================================

/**
 * History - Tier 3
 * Append-only JSONL audit log with temporal fragmentation.
 */
export class HistoryStore {
  private _getSessionPath(projectId: string): string {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const day = getTodayKey()

    return path.join(
      pathManager.getGlobalProjectPath(projectId),
      'memory',
      'sessions',
      yearMonth,
      `${day}.jsonl`
    )
  }

  async appendHistory(
    projectId: string,
    entry: Record<string, unknown> & { type: HistoryEventType }
  ): Promise<void> {
    const sessionPath = this._getSessionPath(projectId)
    await ensureDir(path.dirname(sessionPath))

    const logEntry: HistoryEntry = {
      ts: getTimestamp(),
      ...entry,
      type: entry.type,
    }

    await appendJsonLine(sessionPath, logEntry)
  }

  async getRecentHistory(projectId: string, limit: number = 20): Promise<HistoryEntry[]> {
    const sessionPath = this._getSessionPath(projectId)
    return getLastJsonLines<HistoryEntry>(sessionPath, limit)
  }
}
