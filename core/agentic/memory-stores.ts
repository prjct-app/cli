/**
 * Memory Stores - Base class, Session, History, and Domain Mapping
 *
 * Contains the foundational building blocks of the memory system:
 * - CachedStore<T> abstract base class for SQLite-backed stores
 * - SessionStore (Tier 1) - ephemeral, single command context
 * - HistoryStore (Tier 3) - append-only event log
 * - Domain tag mapping and semantic domain resolution
 *
 * @module agentic/memory-stores
 */

import prjctDb from '../storage/database'
import type { HistoryEntry, HistoryEventType, KnownDomain } from '../types/memory'
import { KNOWN_DOMAINS } from '../types/memory'
import { getTimestamp } from '../utils/date-helper'

/**
 * Resolve a domain string to canonical known domain(s).
 * Known domains pass through; unknown domains default to general.
 * Exported for testing.
 * @see PRJ-300
 */
export function resolveCanonicalDomains(domain: string): KnownDomain[] {
  if ((KNOWN_DOMAINS as readonly string[]).includes(domain)) {
    return [domain as KnownDomain]
  }
  return ['general']
}

// =============================================================================
// Base Store
// =============================================================================

/**
 * Abstract base class for project-scoped, SQLite-backed stores with in-memory caching.
 *
 * Provides lazy loading and project-scoped cache invalidation.
 * Subclasses only need to define the filename (used as doc key), default data
 * structure, and optionally a post-load normalization hook.
 *
 * Extended by {@link PatternStore} and {@link SemanticMemories}.
 *
 * @typeParam T - The shape of the stored data (e.g., `Patterns`, `MemoryDatabase`)
 */
export abstract class CachedStore<T> {
  private _data: T | null = null
  private _loaded: boolean = false
  private _projectId: string | null = null

  /**
   * Return the filename for this store (e.g., `'patterns.json'`).
   * Used to derive the kv_store key.
   */
  protected abstract getFilename(): string

  /**
   * Return the default data structure when no data exists.
   */
  protected abstract getDefault(): T

  /**
   * Optional subdirectory (used in key derivation).
   */
  protected getSubdirectory(): string | null {
    return null
  }

  /**
   * Derive the kv_store key from filename and subdirectory.
   */
  private getStoreKey(): string {
    const base = this.getFilename().replace('.json', '')
    const subdir = this.getSubdirectory()
    if (subdir) {
      return `memory:${subdir}:${base}`
    }
    return `memory:${base}`
  }

  /**
   * Load data from SQLite with project-scoped caching.
   */
  async load(projectId: string): Promise<T> {
    // Return cached if same project and loaded
    if (this._loaded && this._data && this._projectId === projectId) {
      return this._data
    }

    // Load from SQLite
    const key = this.getStoreKey()
    const doc = prjctDb.getDoc<T>(projectId, key)

    if (doc !== null) {
      this._data = doc
      this.afterLoad(this._data)
    } else {
      this._data = this.getDefault()
    }

    this._loaded = true
    this._projectId = projectId

    return this._data
  }

  /**
   * Hook for subclasses to normalize or migrate data after loading.
   */
  protected afterLoad(_data: T): void {
    // Override in subclass if needed
  }

  /**
   * Persist the current in-memory data to SQLite.
   */
  async save(projectId: string): Promise<void> {
    if (!this._data) return

    const key = this.getStoreKey()
    prjctDb.setDoc(projectId, key, this._data)
  }

  /**
   * Access the cached data without triggering a load.
   */
  protected getData(): T | null {
    return this._data
  }

  /**
   * Replace the in-memory data directly. Does not persist —
   * call {@link save} afterwards if persistence is needed.
   */
  protected setData(data: T): void {
    this._data = data
  }

  /**
   * Atomically load, transform, and save data in one operation.
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
   */
  isLoaded(projectId?: string): boolean {
    if (projectId) {
      return this._loaded && this._projectId === projectId
    }
    return this._loaded
  }

  /**
   * Clear the in-memory cache, forcing a fresh load on the next call.
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
 * Append-only event log stored in SQLite events table.
 */
export class HistoryStore {
  async appendHistory(
    projectId: string,
    entry: Record<string, unknown> & { type: HistoryEventType }
  ): Promise<void> {
    const logEntry: HistoryEntry = {
      ts: getTimestamp(),
      ...entry,
      type: entry.type,
    }

    prjctDb.appendEvent(projectId, `history.${entry.type}`, logEntry)
  }

  async getRecentHistory(projectId: string, limit: number = 20): Promise<HistoryEntry[]> {
    const rows = prjctDb.query<{ data: string; timestamp: string }>(
      projectId,
      "SELECT data, timestamp FROM events WHERE type LIKE 'history.%' ORDER BY id DESC LIMIT ?",
      limit
    )

    return rows.reverse().map((row) => JSON.parse(row.data) as HistoryEntry)
  }
}
