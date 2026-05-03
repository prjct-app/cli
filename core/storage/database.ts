/**
 * SQLite Database Manager (PRJ-303)
 *
 * Single SQLite database per project replaces 7+ JSON files.
 * Uses bun:sqlite (native) on Bun, better-sqlite3 on Node.js.
 *
 * Benefits over JSON files:
 * - Atomic writes (WAL mode, no race conditions)
 * - Indexed queries (<1ms lookups vs 10-50ms JSON parse)
 * - Concurrent reads + single writer (WAL)
 * - No file locking needed
 *
 * Storage architecture:
 * - `kv_store` table: Document-style storage (drop-in replacement for JSON files)
 * - Normalized tables: For indexed queries on frequently accessed entities
 * - `events` table: Append-only event log (replaces events.jsonl)
 *
 * @version 2.0.0
 */

import fs from 'node:fs'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import type { MigrationRecord } from '../types/storage/extended'
import { migrations } from './database/migrations'
import {
  openDatabase,
  type SqliteBindings,
  type SqliteDatabase,
  type SqliteStatement,
} from './database/sqlite-compat'

// =============================================================================
// Database Manager
// =============================================================================

/** Max concurrent DB connections before evicting least-recently-used */
const MAX_DB_CONNECTIONS = 3

class PrjctDatabase {
  private connections = new Map<string, SqliteDatabase>()
  private accessOrder: string[] = []
  // Cache prepared statements per-connection. WeakMap keys auto-GC when
  // the SqliteDatabase reference is dropped during evictLru()/close().
  private statementCache = new WeakMap<SqliteDatabase, Map<string, SqliteStatement>>()

  private prepareCached(db: SqliteDatabase, sql: string): SqliteStatement {
    let cache = this.statementCache.get(db)
    if (!cache) {
      cache = new Map()
      this.statementCache.set(db, cache)
    }
    const hit = cache.get(sql)
    if (hit) return hit
    const stmt = db.prepare(sql)
    cache.set(sql, stmt)
    return stmt
  }

  getDbPath(projectId: string): string {
    return path.join(pathManager.getGlobalProjectPath(projectId), 'prjct.db')
  }

  /**
   * Get or create a database connection for a project.
   * Lazily opens the database, runs migrations, and enables WAL mode.
   */
  getDb(projectId: string): SqliteDatabase {
    const existing = this.connections.get(projectId)
    if (existing) {
      this.touchAccessOrder(projectId)
      return existing
    }

    if (this.connections.size >= MAX_DB_CONNECTIONS) this.evictLru()

    const dbPath = this.getDbPath(projectId)
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
    const db = openDatabase(dbPath)

    // Enable WAL mode for concurrent reads + single writer
    db.run('PRAGMA journal_mode = WAL')

    // Performance tuning
    db.run('PRAGMA synchronous = NORMAL')
    db.run('PRAGMA cache_size = -2000') // 2MB cache
    db.run('PRAGMA temp_store = MEMORY')
    db.run('PRAGMA mmap_size = 33554432') // 32MB mmap

    this.runMigrations(db)

    this.connections.set(projectId, db)
    this.touchAccessOrder(projectId)
    return db
  }

  /**
   * Close a specific project's database connection, or all connections.
   */
  close(projectId?: string): void {
    if (projectId) {
      const db = this.connections.get(projectId)
      if (db) {
        db.close()
        this.connections.delete(projectId)
        this.accessOrder = this.accessOrder.filter((id) => id !== projectId)
      }
    } else {
      this.connections.forEach((db) => {
        db.close()
      })
      this.connections.clear()
      this.accessOrder = []
    }
  }

  private touchAccessOrder(projectId: string): void {
    this.accessOrder = this.accessOrder.filter((id) => id !== projectId)
    this.accessOrder.push(projectId)
  }

  private evictLru(): void {
    if (this.accessOrder.length === 0) return
    const lruId = this.accessOrder.shift()!
    const db = this.connections.get(lruId)
    if (db) {
      db.close()
      this.connections.delete(lruId)
    }
  }

  /**
   * Run WAL checkpoint on all open connections to reclaim WAL file space.
   * Uses TRUNCATE mode to reset WAL file to zero bytes.
   */
  checkpointAll(): void {
    for (const [_projectId, db] of this.connections) {
      try {
        db.run('PRAGMA wal_checkpoint(TRUNCATE)')
      } catch {
        // Connection may have been closed externally — skip
      }
    }
  }

  exists(projectId: string): boolean {
    return fs.existsSync(this.getDbPath(projectId))
  }

  // ===========================================================================
  // Document Storage (kv_store)
  // ===========================================================================

  getDoc<T>(projectId: string, key: string): T | null {
    const db = this.getDb(projectId)
    const row = this.prepareCached(db, 'SELECT data FROM kv_store WHERE key = ?').get(key) as {
      data: string
    } | null
    if (!row) return null
    return JSON.parse(row.data) as T
  }

  setDoc<T>(projectId: string, key: string, data: T): void {
    const db = this.getDb(projectId)
    const json = JSON.stringify(data)
    const now = new Date().toISOString()
    this.prepareCached(
      db,
      'INSERT OR REPLACE INTO kv_store (key, data, updated_at) VALUES (?, ?, ?)'
    ).run(key, json, now)
  }

  deleteDoc(projectId: string, key: string): void {
    const db = this.getDb(projectId)
    this.prepareCached(db, 'DELETE FROM kv_store WHERE key = ?').run(key)
  }

  hasDoc(projectId: string, key: string): boolean {
    const db = this.getDb(projectId)
    const row = this.prepareCached(db, 'SELECT 1 FROM kv_store WHERE key = ?').get(key)
    return row !== null
  }

  // ===========================================================================
  // Event Log
  // ===========================================================================

  appendEvent(
    projectId: string,
    type: string,
    data: Record<string, unknown>,
    taskId?: string
  ): void {
    const db = this.getDb(projectId)
    const now = new Date().toISOString()
    this.prepareCached(
      db,
      'INSERT INTO events (type, task_id, data, timestamp) VALUES (?, ?, ?, ?)'
    ).run(type, taskId ?? null, JSON.stringify(data), now)
  }

  getEvents(
    projectId: string,
    type?: string,
    limit = 100
  ): Array<{ id: number; type: string; task_id: string | null; data: string; timestamp: string }> {
    const db = this.getDb(projectId)
    if (type) {
      return this.prepareCached(
        db,
        'SELECT * FROM events WHERE type = ? ORDER BY id DESC LIMIT ?'
      ).all(type, limit) as Array<{
        id: number
        type: string
        task_id: string | null
        data: string
        timestamp: string
      }>
    }
    return this.prepareCached(db, 'SELECT * FROM events ORDER BY id DESC LIMIT ?').all(
      limit
    ) as Array<{
      id: number
      type: string
      task_id: string | null
      data: string
      timestamp: string
    }>
  }

  // ===========================================================================
  // Raw Query Access
  // ===========================================================================

  query<T = Record<string, unknown>>(
    projectId: string,
    sql: string,
    ...params: SqliteBindings[]
  ): T[] {
    const db = this.getDb(projectId)
    return this.prepareCached(db, sql).all(...params) as T[]
  }

  run(projectId: string, sql: string, ...params: SqliteBindings[]): void {
    const db = this.getDb(projectId)
    this.prepareCached(db, sql).run(...params)
  }

  get<T = Record<string, unknown>>(
    projectId: string,
    sql: string,
    ...params: SqliteBindings[]
  ): T | null {
    const db = this.getDb(projectId)
    return (this.prepareCached(db, sql).get(...params) as T) ?? null
  }

  transaction<T>(projectId: string, fn: (db: SqliteDatabase) => T): T {
    const db = this.getDb(projectId)
    return db.transaction(fn)(db)
  }

  // ===========================================================================
  // Migration System
  // ===========================================================================

  private runMigrations(db: SqliteDatabase): void {
    db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version     INTEGER PRIMARY KEY,
        name        TEXT NOT NULL,
        applied_at  TEXT NOT NULL
      )
    `)

    const applied = new Set(
      (db.prepare('SELECT version FROM _migrations').all() as Array<{ version: number }>).map(
        (r) => r.version
      )
    )

    for (const migration of migrations) {
      if (applied.has(migration.version)) continue

      db.transaction(() => {
        migration.up(db)
        db.prepare('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
          migration.version,
          migration.name,
          new Date().toISOString()
        )
      })()
    }
  }

  getMigrations(projectId: string): MigrationRecord[] {
    const db = this.getDb(projectId)
    return db.prepare('SELECT * FROM _migrations ORDER BY version').all() as MigrationRecord[]
  }

  getSchemaVersion(projectId: string): number {
    const db = this.getDb(projectId)
    const row = db.prepare('SELECT MAX(version) as version FROM _migrations').get() as {
      version: number | null
    } | null
    return row?.version ?? 0
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const prjctDb = new PrjctDatabase()
export default prjctDb
export { PrjctDatabase }
