/**
 * SQLite Database Manager (PRJ-303)
 *
 * Single SQLite database per project replaces 7+ JSON files.
 * Uses Bun's built-in SQLite (`bun:sqlite`) — zero external deps.
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
 * @version 1.0.0
 */

import { Database, type SQLQueryBindings } from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'

// =============================================================================
// Types
// =============================================================================

export interface Migration {
  version: number
  name: string
  up: (db: Database) => void
}

export interface MigrationRecord {
  version: number
  name: string
  applied_at: string
}

// =============================================================================
// Schema Migrations
// =============================================================================

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    up: (db: Database) => {
      db.run(`
        -- =======================================================================
        -- Document storage (backward-compatible with JSON file pattern)
        -- =======================================================================
        -- Each row replaces one JSON file (state.json, queue.json, etc.)
        -- StorageManager reads/writes entire documents via key lookup.
        CREATE TABLE kv_store (
          key     TEXT PRIMARY KEY,
          data    TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- =======================================================================
        -- Normalized: Tasks
        -- =======================================================================
        CREATE TABLE tasks (
          id                TEXT PRIMARY KEY,
          description       TEXT NOT NULL,
          type              TEXT,
          status            TEXT NOT NULL,
          parent_description TEXT,
          branch            TEXT,
          linear_id         TEXT,
          linear_uuid       TEXT,
          session_id        TEXT,
          feature_id        TEXT,
          started_at        TEXT NOT NULL,
          completed_at      TEXT,
          shipped_at        TEXT,
          paused_at         TEXT,
          pause_reason      TEXT,
          pr_url            TEXT,
          expected_value    TEXT,
          data              TEXT
        );

        CREATE INDEX idx_tasks_status ON tasks(status);
        CREATE INDEX idx_tasks_type ON tasks(type);
        CREATE INDEX idx_tasks_branch ON tasks(branch);
        CREATE INDEX idx_tasks_linear_id ON tasks(linear_id);

        -- =======================================================================
        -- Normalized: Subtasks
        -- =======================================================================
        CREATE TABLE subtasks (
          id          TEXT PRIMARY KEY,
          task_id     TEXT NOT NULL,
          description TEXT NOT NULL,
          status      TEXT NOT NULL,
          domain      TEXT,
          agent       TEXT,
          sort_order  INTEGER NOT NULL,
          depends_on  TEXT,
          started_at  TEXT,
          completed_at TEXT,
          output      TEXT,
          summary     TEXT,
          FOREIGN KEY (task_id) REFERENCES tasks(id)
        );

        CREATE INDEX idx_subtasks_task_id ON subtasks(task_id);
        CREATE INDEX idx_subtasks_status ON subtasks(status);

        -- =======================================================================
        -- Normalized: Queue Tasks
        -- =======================================================================
        CREATE TABLE queue_tasks (
          id            TEXT PRIMARY KEY,
          description   TEXT NOT NULL,
          type          TEXT,
          priority      TEXT,
          section       TEXT,
          created_at    TEXT NOT NULL,
          completed     INTEGER DEFAULT 0,
          completed_at  TEXT,
          feature_id    TEXT,
          feature_name  TEXT
        );

        CREATE INDEX idx_queue_tasks_section ON queue_tasks(section);
        CREATE INDEX idx_queue_tasks_priority ON queue_tasks(priority);
        CREATE INDEX idx_queue_tasks_completed ON queue_tasks(completed);

        -- =======================================================================
        -- Normalized: Ideas
        -- =======================================================================
        CREATE TABLE ideas (
          id            TEXT PRIMARY KEY,
          text          TEXT NOT NULL,
          status        TEXT NOT NULL DEFAULT 'pending',
          priority      TEXT NOT NULL DEFAULT 'medium',
          tags          TEXT,
          added_at      TEXT NOT NULL,
          converted_to  TEXT,
          details       TEXT,
          data          TEXT
        );

        CREATE INDEX idx_ideas_status ON ideas(status);
        CREATE INDEX idx_ideas_priority ON ideas(priority);

        -- =======================================================================
        -- Normalized: Shipped Features
        -- =======================================================================
        CREATE TABLE shipped_features (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          shipped_at  TEXT NOT NULL,
          version     TEXT NOT NULL,
          description TEXT,
          type        TEXT,
          duration    TEXT,
          data        TEXT
        );

        CREATE INDEX idx_shipped_version ON shipped_features(version);
        CREATE INDEX idx_shipped_at ON shipped_features(shipped_at);

        -- =======================================================================
        -- Events (replaces events.jsonl)
        -- =======================================================================
        CREATE TABLE events (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          type      TEXT NOT NULL,
          task_id   TEXT,
          data      TEXT,
          timestamp TEXT NOT NULL
        );

        CREATE INDEX idx_events_type ON events(type);
        CREATE INDEX idx_events_task_id ON events(task_id);
        CREATE INDEX idx_events_timestamp ON events(timestamp);

        -- =======================================================================
        -- Analysis (draft + sealed)
        -- =======================================================================
        CREATE TABLE analysis (
          id          TEXT PRIMARY KEY,
          status      TEXT NOT NULL,
          commit_hash TEXT,
          signature   TEXT,
          sealed_at   TEXT,
          analyzed_at TEXT,
          data        TEXT NOT NULL
        );

        -- =======================================================================
        -- Index: File scores and checksums
        -- =======================================================================
        CREATE TABLE index_files (
          path        TEXT PRIMARY KEY,
          score       REAL,
          size        INTEGER,
          mtime       TEXT,
          language    TEXT,
          categories  TEXT,
          domain      TEXT
        );

        CREATE INDEX idx_index_files_domain ON index_files(domain);
        CREATE INDEX idx_index_files_score ON index_files(score);

        CREATE TABLE index_checksums (
          path      TEXT PRIMARY KEY,
          checksum  TEXT NOT NULL,
          size      INTEGER,
          mtime     TEXT
        );

        -- =======================================================================
        -- Index: Metadata (project-index, domains, categories-cache)
        -- =======================================================================
        CREATE TABLE index_meta (
          key   TEXT PRIMARY KEY,
          data  TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- =======================================================================
        -- Memory (key-value with domain tagging)
        -- =======================================================================
        CREATE TABLE memory (
          key         TEXT PRIMARY KEY,
          domain      TEXT,
          value       TEXT,
          confidence  REAL DEFAULT 1.0,
          updated_at  TEXT NOT NULL
        );

        CREATE INDEX idx_memory_domain ON memory(domain);

        -- =======================================================================
        -- Metrics: Daily stats for trend analysis
        -- =======================================================================
        CREATE TABLE metrics_daily (
          date                  TEXT PRIMARY KEY,
          tokens_saved          INTEGER NOT NULL DEFAULT 0,
          syncs                 INTEGER NOT NULL DEFAULT 0,
          avg_compression_rate  REAL NOT NULL DEFAULT 0,
          total_duration        INTEGER NOT NULL DEFAULT 0
        );

        -- =======================================================================
        -- Velocity: Sprint data
        -- =======================================================================
        CREATE TABLE velocity_sprints (
          sprint_number       INTEGER PRIMARY KEY,
          points_completed    REAL NOT NULL DEFAULT 0,
          tasks_completed     INTEGER NOT NULL DEFAULT 0,
          estimation_accuracy REAL NOT NULL DEFAULT 0,
          avg_variance        REAL NOT NULL DEFAULT 0,
          started_at          TEXT,
          ended_at            TEXT
        );
      `)
    },
  },
]

// =============================================================================
// Database Manager
// =============================================================================

class PrjctDatabase {
  private connections = new Map<string, Database>()

  /**
   * Get the database file path for a project.
   */
  getDbPath(projectId: string): string {
    return path.join(pathManager.getGlobalProjectPath(projectId), 'prjct.db')
  }

  /**
   * Get or create a database connection for a project.
   * Lazily opens the database, runs migrations, and enables WAL mode.
   */
  getDb(projectId: string): Database {
    const existing = this.connections.get(projectId)
    if (existing) return existing

    const dbPath = this.getDbPath(projectId)
    // Ensure parent directory exists before creating DB
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    const db = new Database(dbPath, { create: true })

    // Enable WAL mode for concurrent reads + single writer
    db.run('PRAGMA journal_mode = WAL')

    // Performance tuning
    db.run('PRAGMA synchronous = NORMAL')
    db.run('PRAGMA cache_size = -2000') // 2MB cache
    db.run('PRAGMA temp_store = MEMORY')
    db.run('PRAGMA mmap_size = 268435456') // 256MB mmap

    // Run pending migrations
    this.runMigrations(db)

    this.connections.set(projectId, db)
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
      }
    } else {
      this.connections.forEach((db) => {
        db.close()
      })
      this.connections.clear()
    }
  }

  /**
   * Check if a database exists for a project (without creating one).
   */
  exists(projectId: string): boolean {
    return fs.existsSync(this.getDbPath(projectId))
  }

  // ===========================================================================
  // Document Storage (kv_store)
  // ===========================================================================

  /**
   * Read a document from kv_store by key.
   * Returns parsed JSON or null if not found.
   */
  getDoc<T>(projectId: string, key: string): T | null {
    const db = this.getDb(projectId)
    const row = db.prepare('SELECT data FROM kv_store WHERE key = ?').get(key) as {
      data: string
    } | null
    if (!row) return null
    return JSON.parse(row.data) as T
  }

  /**
   * Write a document to kv_store.
   * Replaces existing document with same key.
   */
  setDoc<T>(projectId: string, key: string, data: T): void {
    const db = this.getDb(projectId)
    const json = JSON.stringify(data)
    const now = new Date().toISOString()
    db.prepare('INSERT OR REPLACE INTO kv_store (key, data, updated_at) VALUES (?, ?, ?)').run(
      key,
      json,
      now
    )
  }

  /**
   * Delete a document from kv_store.
   */
  deleteDoc(projectId: string, key: string): void {
    const db = this.getDb(projectId)
    db.prepare('DELETE FROM kv_store WHERE key = ?').run(key)
  }

  /**
   * Check if a document exists in kv_store.
   */
  hasDoc(projectId: string, key: string): boolean {
    const db = this.getDb(projectId)
    const row = db.prepare('SELECT 1 FROM kv_store WHERE key = ?').get(key)
    return row !== null
  }

  // ===========================================================================
  // Event Log
  // ===========================================================================

  /**
   * Append an event to the event log.
   */
  appendEvent(
    projectId: string,
    type: string,
    data: Record<string, unknown>,
    taskId?: string
  ): void {
    const db = this.getDb(projectId)
    const now = new Date().toISOString()
    db.prepare('INSERT INTO events (type, task_id, data, timestamp) VALUES (?, ?, ?, ?)').run(
      type,
      taskId ?? null,
      JSON.stringify(data),
      now
    )
  }

  /**
   * Query events by type, with optional limit.
   */
  getEvents(
    projectId: string,
    type?: string,
    limit = 100
  ): Array<{ id: number; type: string; task_id: string | null; data: string; timestamp: string }> {
    const db = this.getDb(projectId)
    if (type) {
      return db
        .prepare('SELECT * FROM events WHERE type = ? ORDER BY id DESC LIMIT ?')
        .all(type, limit) as Array<{
        id: number
        type: string
        task_id: string | null
        data: string
        timestamp: string
      }>
    }
    return db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?').all(limit) as Array<{
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

  /**
   * Execute a raw SQL query that returns rows.
   */
  query<T = Record<string, unknown>>(
    projectId: string,
    sql: string,
    ...params: SQLQueryBindings[]
  ): T[] {
    const db = this.getDb(projectId)
    return db.prepare(sql).all(...params) as T[]
  }

  /**
   * Execute a raw SQL statement (INSERT/UPDATE/DELETE).
   */
  run(projectId: string, sql: string, ...params: SQLQueryBindings[]): void {
    const db = this.getDb(projectId)
    db.prepare(sql).run(...params)
  }

  /**
   * Execute a raw SQL query that returns a single row.
   */
  get<T = Record<string, unknown>>(
    projectId: string,
    sql: string,
    ...params: SQLQueryBindings[]
  ): T | null {
    const db = this.getDb(projectId)
    return (db.prepare(sql).get(...params) as T) ?? null
  }

  /**
   * Run multiple statements in a transaction.
   */
  transaction<T>(projectId: string, fn: (db: Database) => T): T {
    const db = this.getDb(projectId)
    return db.transaction(fn)(db)
  }

  // ===========================================================================
  // Migration System
  // ===========================================================================

  /**
   * Run all pending migrations.
   */
  private runMigrations(db: Database): void {
    // Create migrations table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version     INTEGER PRIMARY KEY,
        name        TEXT NOT NULL,
        applied_at  TEXT NOT NULL
      )
    `)

    // Get applied versions
    const applied = new Set(
      (db.prepare('SELECT version FROM _migrations').all() as Array<{ version: number }>).map(
        (r) => r.version
      )
    )

    // Run pending migrations in order
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

  /**
   * Get applied migrations for a project.
   */
  getMigrations(projectId: string): MigrationRecord[] {
    const db = this.getDb(projectId)
    return db.prepare('SELECT * FROM _migrations ORDER BY version').all() as MigrationRecord[]
  }

  /**
   * Get the current schema version.
   */
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
