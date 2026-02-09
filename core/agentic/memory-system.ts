/**
 * Memory System
 * Tracks user preferences, decisions, and learned patterns.
 *
 * Three-tier memory system:
 * - Tier 1: Session (ephemeral) - single command context
 * - Tier 2: Patterns (persistent) - learned preferences and decisions
 * - Tier 3: History (JSONL) - append-only audit log
 *
 * @module agentic/memory-system
 * @version 3.3
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import { generateUUID } from '../schemas'
import { isNotFoundError } from '../types/fs'
import { getTimestamp, getTodayKey } from '../utils/date-helper'
import { ensureDir } from '../utils/file-helper'
import { appendJsonLine, getLastJsonLines } from '../utils/jsonl-helper'

// Re-export types from canonical location
export type {
  ConfidenceLevel,
  Decision,
  HistoryEntry,
  HistoryEventType,
  KnownDomain,
  Memory,
  MemoryContext,
  MemoryContextParams,
  MemoryDatabase,
  MemoryRetrievalResult,
  MemoryTag,
  Patterns,
  Preference,
  RelevantMemoryQuery,
  ScoredMemory,
  TaskDomain,
  Workflow,
} from '../types/memory'

export { calculateConfidence, KNOWN_DOMAINS, MEMORY_TAGS } from '../types/memory'

import type {
  HistoryEntry,
  HistoryEventType,
  KnownDomain,
  Memory,
  MemoryContext,
  MemoryDatabase,
  MemoryRetrievalResult,
  MemoryTag,
  Patterns,
  Preference,
  RelevantMemoryQuery,
  ScoredMemory,
  TaskDomain,
  Workflow,
} from '../types/memory'

import { calculateConfidence, KNOWN_DOMAINS, MEMORY_TAGS } from '../types/memory'

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
 * Used to resolve unknown domain strings (e.g., "uxui" → frontend)
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

// =============================================================================
// Pattern Store (Tier 2)
// =============================================================================

/**
 * Patterns - Tier 2
 * Persistent learned preferences and decisions.
 */
export class PatternStore extends CachedStore<Patterns> {
  private static readonly MAX_CONTEXTS = 20
  private static readonly ARCHIVE_AGE_DAYS = 90

  protected getFilename(): string {
    return 'patterns.json'
  }

  protected getDefault(): Patterns {
    return {
      version: 1,
      decisions: {},
      preferences: {},
      workflows: {},
      counters: {},
    }
  }

  protected afterLoad(patterns: Patterns): void {
    for (const decision of Object.values(patterns.decisions)) {
      if (decision.contexts.length > PatternStore.MAX_CONTEXTS) {
        decision.contexts = decision.contexts.slice(-PatternStore.MAX_CONTEXTS)
      }
    }
  }

  // Convenience alias for backward compatibility
  async loadPatterns(projectId: string): Promise<Patterns> {
    return this.load(projectId)
  }

  async savePatterns(projectId: string): Promise<void> {
    return this.save(projectId)
  }

  async recordDecision(
    projectId: string,
    key: string,
    value: string,
    context: string = '',
    options: { userConfirmed?: boolean } = {}
  ): Promise<void> {
    const patterns = await this.load(projectId)
    const now = getTimestamp()

    if (!patterns.decisions[key]) {
      patterns.decisions[key] = {
        value,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        confidence: options.userConfirmed ? 'high' : 'low',
        contexts: [context].filter(Boolean),
        userConfirmed: options.userConfirmed || false,
      } as Patterns['decisions'][string]
    } else {
      const decision = patterns.decisions[key] as Patterns['decisions'][string] & {
        userConfirmed?: boolean
      }

      if (decision.value === value) {
        decision.count++
        decision.lastSeen = now
        if (context && !decision.contexts.includes(context)) {
          decision.contexts.push(context)
          if (decision.contexts.length > PatternStore.MAX_CONTEXTS) {
            decision.contexts = decision.contexts.slice(-PatternStore.MAX_CONTEXTS)
          }
        }
        if (options.userConfirmed) {
          decision.userConfirmed = true
        }
        decision.confidence = calculateConfidence(decision.count, decision.userConfirmed)
      } else {
        decision.value = value
        decision.count = 1
        decision.lastSeen = now
        decision.userConfirmed = options.userConfirmed || false
        decision.confidence = options.userConfirmed ? 'high' : 'low'
      }
    }

    await this.save(projectId)
  }

  async confirmDecision(projectId: string, key: string): Promise<boolean> {
    const patterns = await this.load(projectId)
    const decision = patterns.decisions[key] as
      | (Patterns['decisions'][string] & { userConfirmed?: boolean })
      | undefined
    if (!decision) return false

    decision.userConfirmed = true
    decision.confidence = 'high'
    decision.lastSeen = getTimestamp()
    await this.save(projectId)
    return true
  }

  async getDecision(
    projectId: string,
    key: string
  ): Promise<{ value: string; confidence: string } | null> {
    const patterns = await this.load(projectId)
    const decision = patterns.decisions[key]

    if (!decision) return null
    if (decision.confidence === 'low') return null

    return { value: decision.value, confidence: decision.confidence }
  }

  async hasPattern(projectId: string, key: string): Promise<boolean> {
    const decision = await this.getDecision(projectId, key)
    return decision !== null
  }

  async recordWorkflow(
    projectId: string,
    workflowName: string,
    pattern: Record<string, unknown>
  ): Promise<void> {
    const patterns = await this.load(projectId)
    const now = getTimestamp()

    if (!patterns.workflows[workflowName]) {
      patterns.workflows[workflowName] = {
        ...pattern,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        confidence: 'low',
        userConfirmed: false,
      }
    } else {
      const workflow = patterns.workflows[workflowName]
      workflow.count++
      workflow.lastSeen = now
      workflow.confidence = calculateConfidence(workflow.count, workflow.userConfirmed)
    }

    await this.save(projectId)
  }

  async confirmWorkflow(projectId: string, workflowName: string): Promise<boolean> {
    const patterns = await this.load(projectId)
    const workflow = patterns.workflows[workflowName]
    if (!workflow) return false

    workflow.userConfirmed = true
    workflow.confidence = 'high'
    workflow.lastSeen = getTimestamp()
    await this.save(projectId)
    return true
  }

  async getWorkflow(projectId: string, workflowName: string): Promise<Workflow | null> {
    const patterns = await this.load(projectId)
    const workflow = patterns.workflows[workflowName]

    if (!workflow || workflow.count < 3) return null
    return workflow
  }

  async setPreference(
    projectId: string,
    key: string,
    value: Preference['value'],
    options: { userConfirmed?: boolean } = {}
  ): Promise<void> {
    const patterns = await this.load(projectId)
    const existing = patterns.preferences[key]
    const observationCount = existing ? existing.observationCount + 1 : 1
    const userConfirmed = options.userConfirmed || existing?.userConfirmed || false

    patterns.preferences[key] = {
      value,
      updatedAt: getTimestamp(),
      confidence: calculateConfidence(observationCount, userConfirmed),
      observationCount,
      userConfirmed,
    }
    await this.save(projectId)
  }

  async confirmPreference(projectId: string, key: string): Promise<boolean> {
    const patterns = await this.load(projectId)
    const pref = patterns.preferences[key]
    if (!pref) return false

    pref.userConfirmed = true
    pref.confidence = 'high'
    pref.updatedAt = getTimestamp()
    await this.save(projectId)
    return true
  }

  async getPreference(
    projectId: string,
    key: string,
    defaultValue: unknown = null
  ): Promise<unknown> {
    const patterns = await this.load(projectId)
    return patterns.preferences[key]?.value ?? defaultValue
  }

  async getPatternsSummary(projectId: string) {
    const patterns = await this.load(projectId)

    return {
      decisions: Object.keys(patterns.decisions).length,
      learnedDecisions: Object.values(patterns.decisions).filter((d) => d.confidence !== 'low')
        .length,
      workflows: Object.keys(patterns.workflows).length,
      preferences: Object.keys(patterns.preferences).length,
    }
  }

  private _getArchivePath(projectId: string): string {
    const basePath = path.join(pathManager.getGlobalProjectPath(projectId), 'memory')
    return path.join(basePath, 'patterns-archive.json')
  }

  async archiveStaleDecisions(projectId: string): Promise<number> {
    const patterns = await this.load(projectId)
    const now = Date.now()
    const cutoff = PatternStore.ARCHIVE_AGE_DAYS * 24 * 60 * 60 * 1000

    const staleKeys: string[] = []
    for (const [key, decision] of Object.entries(patterns.decisions)) {
      const lastSeenMs = new Date(decision.lastSeen).getTime()
      if (now - lastSeenMs > cutoff) {
        staleKeys.push(key)
      }
    }

    if (staleKeys.length === 0) return 0

    // Load or create archive
    const archivePath = this._getArchivePath(projectId)
    let archive: Record<string, unknown> = {}
    try {
      const content = await fs.readFile(archivePath, 'utf-8')
      archive = JSON.parse(content)
    } catch (error) {
      if (!isNotFoundError(error)) throw error
    }

    // Move stale decisions to archive
    for (const key of staleKeys) {
      archive[key] = patterns.decisions[key]
      delete patterns.decisions[key]
    }

    // Save archive and pruned patterns
    await fs.mkdir(path.dirname(archivePath), { recursive: true })
    await fs.writeFile(archivePath, JSON.stringify(archive, null, 2), 'utf-8')
    await this.save(projectId)

    return staleKeys.length
  }
}

// =============================================================================
// Semantic Memories
// =============================================================================

/**
 * Semantic Memories
 * P3.3: Tagged, searchable, CRUD memory operations.
 */
export class SemanticMemories extends CachedStore<MemoryDatabase> {
  protected getFilename(): string {
    return 'memories.json'
  }

  protected getDefault(): MemoryDatabase {
    return {
      version: 1,
      memories: [],
      index: this._createEmptyIndex(),
    }
  }

  protected afterLoad(db: MemoryDatabase): void {
    this._normalizeIndex(db)
  }

  private _createEmptyIndex(): Record<string, string[]> {
    const tags = Object.values(MEMORY_TAGS)
    const index: Record<string, string[]> = {}
    for (const tag of tags) index[tag] = []
    return index
  }

  private _normalizeIndex(db: MemoryDatabase): void {
    // Reason: older persisted files may not include newer tags; ensure all tags are present.
    const tags = Object.values(MEMORY_TAGS)
    for (const tag of tags) {
      if (!db.index[tag]) db.index[tag] = []
    }
  }

  private _coerceTags(tags: string[]): MemoryTag[] {
    const allowed = new Set<MemoryTag>(Object.values(MEMORY_TAGS) as MemoryTag[])
    return tags.filter((t): t is MemoryTag => allowed.has(t as MemoryTag))
  }

  // Convenience alias for backward compatibility
  async loadMemories(projectId: string): Promise<MemoryDatabase> {
    return this.load(projectId)
  }

  async saveMemories(projectId: string): Promise<void> {
    return this.save(projectId)
  }

  async createMemory(
    projectId: string,
    {
      title,
      content,
      tags = [],
      userTriggered = false,
    }: { title: string; content: string; tags?: string[]; userTriggered?: boolean }
  ): Promise<string> {
    const db = await this.load(projectId)
    const parsedTags = this._coerceTags(tags)
    const now = getTimestamp()

    const memory: Memory = {
      id: generateUUID(),
      title,
      content,
      tags: parsedTags,
      userTriggered,
      createdAt: now,
      updatedAt: now,
    }

    db.memories.push(memory)

    for (const tag of parsedTags) {
      db.index[tag].push(memory.id)
    }

    await this.save(projectId)
    return memory.id
  }

  async updateMemory(
    projectId: string,
    memoryId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ): Promise<boolean> {
    const db = await this.load(projectId)

    const index = db.memories.findIndex((m) => m.id === memoryId)
    if (index === -1) return false

    const memory = db.memories[index]
    const oldTags = memory.tags || []

    if (updates.title) memory.title = updates.title
    if (updates.content) memory.content = updates.content
    if (updates.tags) {
      const newTags = this._coerceTags(updates.tags)
      for (const tag of oldTags) {
        db.index[tag] = db.index[tag].filter((id: string) => id !== memoryId)
      }
      for (const tag of newTags) {
        db.index[tag].push(memoryId)
      }
      memory.tags = newTags
    }

    memory.updatedAt = getTimestamp()
    await this.save(projectId)
    return true
  }

  async deleteMemory(projectId: string, memoryId: string): Promise<boolean> {
    const db = await this.load(projectId)

    const index = db.memories.findIndex((m) => m.id === memoryId)
    if (index === -1) return false

    const memory = db.memories[index]

    for (const tag of memory.tags || []) {
      if (db.index[tag]) {
        db.index[tag] = db.index[tag].filter((id) => id !== memoryId)
      }
    }

    db.memories.splice(index, 1)
    await this.save(projectId)
    return true
  }

  async findByTags(
    projectId: string,
    tags: string[],
    matchAll: boolean = false
  ): Promise<Memory[]> {
    const db = await this.load(projectId)
    const parsedTags = this._coerceTags(tags)

    if (matchAll) {
      return db.memories.filter((m) => parsedTags.every((tag) => (m.tags || []).includes(tag)))
    } else {
      const matchingIds = new Set<string>()
      for (const tag of parsedTags) {
        const ids = db.index[tag]
        for (const id of ids) {
          matchingIds.add(id)
        }
      }
      return db.memories.filter((m) => matchingIds.has(m.id))
    }
  }

  async searchMemories(projectId: string, query: string): Promise<Memory[]> {
    const db = await this.load(projectId)
    const queryLower = query.toLowerCase()

    return db.memories.filter(
      (m) =>
        m.title.toLowerCase().includes(queryLower) || m.content.toLowerCase().includes(queryLower)
    )
  }

  async getRelevantMemories(
    projectId: string,
    context: MemoryContext,
    limit: number = 5
  ): Promise<Memory[]> {
    const db = await this.load(projectId)

    const scored = db.memories.map((memory) => {
      let score = 0

      const contextTags = this._extractContextTags(context)
      for (const tag of memory.tags || []) {
        if (contextTags.includes(tag)) score += 10
      }

      const age = Date.now() - new Date(memory.updatedAt).getTime()
      const daysSinceUpdate = age / (1000 * 60 * 60 * 24)
      score += Math.max(0, 5 - daysSinceUpdate)

      if (memory.userTriggered) score += 5

      const keywords = this._extractKeywords(context)
      for (const keyword of keywords) {
        if (memory.content.toLowerCase().includes(keyword)) score += 2
        if (memory.title.toLowerCase().includes(keyword)) score += 3
      }

      return { ...memory, _score: score }
    })

    return scored
      .filter((m) => m._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...memory }) => memory as Memory)
  }

  /**
   * Enhanced memory retrieval with domain-based filtering and metrics.
   * Implements selective memory retrieval based on task relevance.
   * @see PRJ-107
   */
  async getRelevantMemoriesWithMetrics(
    projectId: string,
    query: RelevantMemoryQuery
  ): Promise<MemoryRetrievalResult> {
    const db = await this.load(projectId)
    const totalMemories = db.memories.length

    if (totalMemories === 0) {
      return {
        memories: [],
        metrics: {
          totalMemories: 0,
          memoriesConsidered: 0,
          memoriesReturned: 0,
          filteringRatio: 0,
          avgRelevanceScore: 0,
        },
      }
    }

    const maxResults = query.maxResults ?? 10
    const minRelevance = query.minRelevance ?? 10

    // Score all memories
    const scored: ScoredMemory[] = db.memories.map((memory) => {
      const breakdown = {
        domainMatch: 0,
        tagMatch: 0,
        recency: 0,
        confidence: 0,
        keywords: 0,
        userTriggered: 0,
      }

      // Domain match scoring (0-25 points) — semantic matching (PRJ-300)
      if (query.taskDomain) {
        breakdown.domainMatch = this._getSemanticDomainScore(query.taskDomain, memory.tags || [])
      }

      // Tag match from command context (0-20 points)
      if (query.commandName) {
        const commandTags = this._getCommandTags(query.commandName)
        const matchingTags = (memory.tags || []).filter((tag) => commandTags.includes(tag))
        breakdown.tagMatch = Math.min(20, matchingTags.length * 8)
      }

      // Recency scoring (0-15 points)
      const age = Date.now() - new Date(memory.updatedAt).getTime()
      const daysSinceUpdate = age / (1000 * 60 * 60 * 24)
      breakdown.recency = Math.max(0, Math.round(15 - daysSinceUpdate * 0.5))

      // Confidence scoring (0-20 points) - PRJ-104 integration
      if (memory.confidence) {
        breakdown.confidence =
          memory.confidence === 'high' ? 20 : memory.confidence === 'medium' ? 12 : 5
      } else if (memory.observationCount) {
        // Fallback to observation count
        breakdown.confidence = Math.min(20, memory.observationCount * 3)
      }

      // Keyword matching (0-15 points)
      if (query.taskDescription) {
        const keywords = this._extractKeywordsFromText(query.taskDescription)
        let keywordScore = 0
        for (const keyword of keywords) {
          if (memory.content.toLowerCase().includes(keyword)) keywordScore += 2
          if (memory.title.toLowerCase().includes(keyword)) keywordScore += 3
        }
        breakdown.keywords = Math.min(15, keywordScore)
      }

      // User triggered bonus (0-5 points)
      if (memory.userTriggered) {
        breakdown.userTriggered = 5
      }

      const relevanceScore =
        breakdown.domainMatch +
        breakdown.tagMatch +
        breakdown.recency +
        breakdown.confidence +
        breakdown.keywords +
        breakdown.userTriggered

      return {
        ...memory,
        relevanceScore,
        scoreBreakdown: breakdown,
      }
    })

    // Filter by minimum relevance
    const considered = scored.filter((m) => m.relevanceScore >= minRelevance)

    // Sort by relevance and take top N
    const sorted = considered.sort((a, b) => b.relevanceScore - a.relevanceScore)
    const returned = sorted.slice(0, maxResults)

    // Calculate average relevance
    const avgRelevanceScore =
      returned.length > 0
        ? Math.round(returned.reduce((sum, m) => sum + m.relevanceScore, 0) / returned.length)
        : 0

    return {
      memories: returned,
      metrics: {
        totalMemories,
        memoriesConsidered: considered.length,
        memoriesReturned: returned.length,
        filteringRatio: totalMemories > 0 ? returned.length / totalMemories : 0,
        avgRelevanceScore,
      },
    }
  }

  /**
   * Compute semantic domain match score (0-25 points).
   *
   * Two-pass scoring:
   * 1. Exact MEMORY_TAG match: memory tag in domain's tag list → 10 pts each
   * 2. Semantic match: memory tag relates to domain via keywords → 5 pts each
   *
   * Unknown domains are resolved to canonical domain(s) via SEMANTIC_DOMAIN_KEYWORDS.
   * @see PRJ-107, PRJ-300
   */
  private _getSemanticDomainScore(domain: TaskDomain, memoryTags: string[]): number {
    // Resolve to canonical domain(s)
    const canonicals = this._resolveCanonicalDomains(domain)
    if (canonicals.length === 0) return 0

    // Collect all relevant MEMORY_TAGS for the canonical domains
    const relevantTags = new Set<string>()
    for (const canonical of canonicals) {
      const tags = DOMAIN_TAG_MAP[canonical]
      if (tags) {
        for (const tag of tags) relevantTags.add(tag)
      }
    }

    // Collect semantic keywords for the canonical domains
    const domainKeywords = new Set<string>()
    for (const canonical of canonicals) {
      const keywords = SEMANTIC_DOMAIN_KEYWORDS[canonical]
      if (keywords) {
        for (const kw of keywords) domainKeywords.add(kw)
      }
    }

    let score = 0

    for (const tag of memoryTags) {
      // Pass 1: exact MEMORY_TAG match (10 pts)
      if (relevantTags.has(tag)) {
        score += 10
        continue
      }
      // Pass 2: semantic keyword match (5 pts)
      const normalized = tag.toLowerCase().replace(/[-_\s]/g, '')
      for (const kw of domainKeywords) {
        if (normalized.includes(kw) || kw.includes(normalized)) {
          score += 5
          break
        }
      }
    }

    return Math.min(25, score)
  }

  /**
   * Resolve a domain string to canonical known domain(s).
   * Delegates to module-level resolveCanonicalDomains().
   * @see PRJ-300
   */
  private _resolveCanonicalDomains(domain: TaskDomain): KnownDomain[] {
    return resolveCanonicalDomains(domain)
  }

  /**
   * Map command to relevant memory tags.
   * @see PRJ-107
   */
  private _getCommandTags(commandName: string): MemoryTag[] {
    const commandTags: Record<string, MemoryTag[]> = {
      ship: [MEMORY_TAGS.COMMIT_STYLE, MEMORY_TAGS.SHIP_WORKFLOW, MEMORY_TAGS.TEST_BEHAVIOR],
      feature: [MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.CODE_STYLE],
      done: [MEMORY_TAGS.SHIP_WORKFLOW],
      analyze: [MEMORY_TAGS.TECH_STACK, MEMORY_TAGS.ARCHITECTURE],
      spec: [MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.CODE_STYLE],
      task: [MEMORY_TAGS.BRANCH_NAMING, MEMORY_TAGS.CODE_STYLE],
      sync: [MEMORY_TAGS.TECH_STACK, MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.DEPENDENCIES],
      test: [MEMORY_TAGS.TEST_BEHAVIOR],
      bug: [MEMORY_TAGS.CODE_STYLE, MEMORY_TAGS.TEST_BEHAVIOR],
    }
    return commandTags[commandName] || []
  }

  /**
   * Extract keywords from text for matching.
   */
  private _extractKeywordsFromText(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/)
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'to',
      'for',
      'and',
      'or',
      'in',
      'on',
      'at',
      'by',
      'with',
      'from',
      'as',
      'it',
      'this',
      'that',
      'be',
      'have',
      'has',
    ])
    return words.filter((w) => w.length > 2 && !stopWords.has(w))
  }

  private _extractContextTags(context: MemoryContext): string[] {
    const tags: string[] = []

    const commandTags: Record<string, string[]> = {
      ship: [MEMORY_TAGS.COMMIT_STYLE, MEMORY_TAGS.SHIP_WORKFLOW, MEMORY_TAGS.TEST_BEHAVIOR],
      feature: [MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.CODE_STYLE],
      done: [MEMORY_TAGS.SHIP_WORKFLOW],
      analyze: [MEMORY_TAGS.TECH_STACK, MEMORY_TAGS.ARCHITECTURE],
      spec: [MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.CODE_STYLE],
    }

    if (context.commandName && commandTags[context.commandName]) {
      tags.push(...commandTags[context.commandName])
    }

    return tags
  }

  private _extractKeywords(context: MemoryContext): string[] {
    const keywords: string[] = []

    if (context.params?.description) {
      keywords.push(...(context.params.description as string).toLowerCase().split(/\s+/))
    }
    if (context.params?.feature) {
      keywords.push(...(context.params.feature as string).toLowerCase().split(/\s+/))
    }

    const stopWords = ['the', 'a', 'an', 'is', 'are', 'to', 'for', 'and', 'or', 'in']
    return keywords.filter((k) => k.length > 2 && !stopWords.includes(k))
  }

  async autoRemember(
    projectId: string,
    decisionType: string,
    value: string,
    context: string = ''
  ): Promise<void> {
    const tagMap: Record<string, string[]> = {
      commit_footer: [MEMORY_TAGS.COMMIT_STYLE],
      branch_naming: [MEMORY_TAGS.BRANCH_NAMING],
      test_before_ship: [MEMORY_TAGS.TEST_BEHAVIOR, MEMORY_TAGS.SHIP_WORKFLOW],
      preferred_agent: [MEMORY_TAGS.AGENT_PREFERENCE],
      code_style: [MEMORY_TAGS.CODE_STYLE],
      verbosity: [MEMORY_TAGS.OUTPUT_VERBOSITY],
    }

    const tags = tagMap[decisionType] || []

    const existing = await this.searchMemories(projectId, decisionType)
    if (existing.length > 0) {
      await this.updateMemory(projectId, existing[0].id, {
        content: `${decisionType}: ${value}`,
        tags,
      })
    } else {
      await this.createMemory(projectId, {
        title: `Preference: ${decisionType}`,
        content: `${decisionType}: ${value}${context ? `\nContext: ${context}` : ''}`,
        tags,
        userTriggered: true,
      })
    }
  }

  async getAllMemories(projectId: string): Promise<Memory[]> {
    const db = await this.load(projectId)
    return db.memories
  }

  async getMemoryStats(projectId: string) {
    const db = await this.load(projectId)

    const tagCounts: Record<string, number> = {}
    for (const [tag, ids] of Object.entries(db.index)) {
      tagCounts[tag] = ids.length
    }

    return {
      totalMemories: db.memories.length,
      userTriggered: db.memories.filter((m) => m.userTriggered).length,
      tagCounts,
      oldestMemory: db.memories[0]?.createdAt,
      newestMemory: db.memories[db.memories.length - 1]?.createdAt,
    }
  }
}

// =============================================================================
// Memory System (Main Class)
// =============================================================================

/**
 * Three-tier memory system for learning user patterns.
 * Tier 1: Session (ephemeral), Tier 2: Patterns (persistent), Tier 3: History (JSONL)
 */
export class MemorySystem {
  private _semanticMemories: SemanticMemories
  private _patternStore: PatternStore
  private _historyStore: HistoryStore
  private _sessionStore: SessionStore

  constructor() {
    this._semanticMemories = new SemanticMemories()
    this._patternStore = new PatternStore()
    this._historyStore = new HistoryStore()
    this._sessionStore = new SessionStore()
  }

  // ===========================================================================
  // P3.3: SEMANTIC MEMORIES
  // ===========================================================================

  loadMemories(projectId: string) {
    return this._semanticMemories.loadMemories(projectId)
  }

  saveMemories(projectId: string) {
    return this._semanticMemories.saveMemories(projectId)
  }

  createMemory(
    projectId: string,
    options: { title: string; content: string; tags?: string[]; userTriggered?: boolean }
  ): Promise<string> {
    return this._semanticMemories.createMemory(projectId, options)
  }

  updateMemory(
    projectId: string,
    memoryId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ): Promise<boolean> {
    return this._semanticMemories.updateMemory(projectId, memoryId, updates)
  }

  deleteMemory(projectId: string, memoryId: string): Promise<boolean> {
    return this._semanticMemories.deleteMemory(projectId, memoryId)
  }

  findByTags(projectId: string, tags: string[], matchAll?: boolean): Promise<Memory[]> {
    return this._semanticMemories.findByTags(projectId, tags, matchAll)
  }

  searchMemories(projectId: string, query: string): Promise<Memory[]> {
    return this._semanticMemories.searchMemories(projectId, query)
  }

  getRelevantMemories(
    projectId: string,
    context: MemoryContext,
    limit?: number
  ): Promise<Memory[]> {
    return this._semanticMemories.getRelevantMemories(projectId, context, limit)
  }

  autoRemember(
    projectId: string,
    decisionType: string,
    value: string,
    context?: string
  ): Promise<void> {
    return this._semanticMemories.autoRemember(projectId, decisionType, value, context)
  }

  getAllMemories(projectId: string): Promise<Memory[]> {
    return this._semanticMemories.getAllMemories(projectId)
  }

  getMemoryStats(projectId: string) {
    return this._semanticMemories.getMemoryStats(projectId)
  }

  /**
   * Get relevant memories with domain-based filtering and metrics.
   * Implements selective memory retrieval based on task relevance.
   * @see PRJ-107
   */
  getRelevantMemoriesWithMetrics(
    projectId: string,
    query: RelevantMemoryQuery
  ): Promise<MemoryRetrievalResult> {
    return this._semanticMemories.getRelevantMemoriesWithMetrics(projectId, query)
  }

  // ===========================================================================
  // TIER 1: Session Memory
  // ===========================================================================

  setSession(key: string, value: unknown): void {
    this._sessionStore.setSession(key, value)
  }

  getSession(key: string): unknown {
    return this._sessionStore.getSession(key)
  }

  clearSession(): void {
    this._sessionStore.clearSession()
  }

  // ===========================================================================
  // TIER 2: Patterns
  // ===========================================================================

  loadPatterns(projectId: string) {
    return this._patternStore.loadPatterns(projectId)
  }

  savePatterns(projectId: string) {
    return this._patternStore.savePatterns(projectId)
  }

  recordDecision(projectId: string, key: string, value: string, context?: string): Promise<void> {
    return this._patternStore.recordDecision(projectId, key, value, context)
  }

  getDecision(
    projectId: string,
    key: string
  ): Promise<{ value: string; confidence: string } | null> {
    return this._patternStore.getDecision(projectId, key)
  }

  hasPattern(projectId: string, key: string): Promise<boolean> {
    return this._patternStore.hasPattern(projectId, key)
  }

  recordWorkflow(
    projectId: string,
    workflowName: string,
    pattern: Record<string, unknown>
  ): Promise<void> {
    return this._patternStore.recordWorkflow(projectId, workflowName, pattern)
  }

  getWorkflow(projectId: string, workflowName: string): Promise<Workflow | null> {
    return this._patternStore.getWorkflow(projectId, workflowName)
  }

  setPreference(
    projectId: string,
    key: string,
    value: Preference['value'],
    options?: { userConfirmed?: boolean }
  ): Promise<void> {
    return this._patternStore.setPreference(projectId, key, value, options)
  }

  getPreference(projectId: string, key: string, defaultValue?: unknown): Promise<unknown> {
    return this._patternStore.getPreference(projectId, key, defaultValue)
  }

  confirmPreference(projectId: string, key: string): Promise<boolean> {
    return this._patternStore.confirmPreference(projectId, key)
  }

  confirmDecision(projectId: string, key: string): Promise<boolean> {
    return this._patternStore.confirmDecision(projectId, key)
  }

  confirmWorkflow(projectId: string, workflowName: string): Promise<boolean> {
    return this._patternStore.confirmWorkflow(projectId, workflowName)
  }

  getPatternsSummary(projectId: string) {
    return this._patternStore.getPatternsSummary(projectId)
  }

  archiveStaleDecisions(projectId: string): Promise<number> {
    return this._patternStore.archiveStaleDecisions(projectId)
  }

  // ===========================================================================
  // TIER 3: History
  // ===========================================================================

  appendHistory(
    projectId: string,
    entry: Record<string, unknown> & { type: HistoryEventType }
  ): Promise<void> {
    return this._historyStore.appendHistory(projectId, entry)
  }

  getRecentHistory(projectId: string, limit?: number) {
    return this._historyStore.getRecentHistory(projectId, limit)
  }

  // ===========================================================================
  // CONVENIENCE: Combined operations
  // ===========================================================================

  async getSmartDecision(projectId: string, key: string): Promise<string | null> {
    const sessionValue = this.getSession(`decision:${key}`)
    if (sessionValue !== undefined) return sessionValue as string

    const pattern = await this.getDecision(projectId, key)
    if (pattern) return pattern.value

    return null
  }

  async learnDecision(
    projectId: string,
    key: string,
    value: string,
    context: string = ''
  ): Promise<void> {
    this.setSession(`decision:${key}`, value)
    await this.recordDecision(projectId, key, value, context)
    await this.appendHistory(projectId, { type: 'decision', key, value, context })
  }

  /**
   * Reset internal state (for testing)
   */
  resetState(): void {
    this._sessionStore.clearSession()
    this._semanticMemories.reset()
    this._patternStore.reset()
  }
}

// =============================================================================
// Default Export
// =============================================================================

const memorySystem = new MemorySystem()
export default memorySystem
