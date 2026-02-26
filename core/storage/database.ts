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
import { isBun } from '../utils/runtime'

// =============================================================================
// SQLite Compatibility Layer (bun:sqlite + better-sqlite3)
// =============================================================================

/** Bind parameter types accepted by both drivers */
type SqliteBindings = string | number | bigint | Buffer | null | undefined

/** Minimal prepared-statement interface shared by both drivers */
interface SqliteStatement {
  get(...params: SqliteBindings[]): unknown
  all(...params: SqliteBindings[]): unknown[]
  run(...params: SqliteBindings[]): void
}

/** Minimal database interface shared by bun:sqlite and better-sqlite3 */
interface SqliteDatabase {
  prepare(sql: string): SqliteStatement
  run(sql: string): void
  close(): void
  transaction<T>(fn: (...args: SqliteDatabase[]) => T): (...args: SqliteDatabase[]) => T
}

/**
 * Open a SQLite database using the runtime-appropriate driver.
 * bun:sqlite on Bun, better-sqlite3 on Node.js.
 *
 * better-sqlite3 uses `exec()` for raw SQL where bun:sqlite uses `run()`,
 * so we patch `run` onto the better-sqlite3 instance for API parity.
 */
function openDatabase(dbPath: string): SqliteDatabase {
  if (isBun()) {
    const { Database } = require('bun:sqlite')
    return new Database(dbPath, { create: true }) as SqliteDatabase
  }
  const BetterSqlite3 = require('better-sqlite3')
  const db = new BetterSqlite3(dbPath)
  // better-sqlite3 uses exec() for raw SQL; bun:sqlite uses run()
  const origExec = db.exec.bind(db)
  db.run = (sql: string) => origExec(sql)
  return db as SqliteDatabase
}

// =============================================================================
// Types
// =============================================================================

import type { Migration, MigrationRecord } from '../types/storage.js'

// =============================================================================
// Schema Migrations
// =============================================================================

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    up: (db: SqliteDatabase) => {
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
  {
    version: 2,
    name: 'archives-table',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Archives: Stale data moved out of active storage (PRJ-267)
        -- =======================================================================
        CREATE TABLE archives (
          id            TEXT PRIMARY KEY,
          entity_type   TEXT NOT NULL,
          entity_id     TEXT NOT NULL,
          entity_data   TEXT NOT NULL,
          summary       TEXT,
          archived_at   TEXT NOT NULL,
          reason        TEXT NOT NULL
        );

        CREATE INDEX idx_archives_entity_type ON archives(entity_type);
        CREATE INDEX idx_archives_archived_at ON archives(archived_at);
        CREATE INDEX idx_archives_entity_id ON archives(entity_id);
      `)
    },
  },
  {
    version: 3,
    name: 'workflow-rules-table',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Workflow Rules: hooks, gates, and custom steps (Phase 2)
        -- =======================================================================
        CREATE TABLE workflow_rules (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          type        TEXT NOT NULL,
          command     TEXT NOT NULL,
          position    TEXT NOT NULL,
          action      TEXT NOT NULL,
          description TEXT,
          enabled     INTEGER NOT NULL DEFAULT 1,
          timeout_ms  INTEGER NOT NULL DEFAULT 60000,
          created_at  TEXT NOT NULL,
          sort_order  INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX idx_workflow_rules_command ON workflow_rules(command);
      `)
    },
  },
  {
    version: 4,
    name: 'custom-workflows-table',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Custom Workflows: User-defined workflows with agentic auto-config
        -- =======================================================================
        CREATE TABLE custom_workflows (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT UNIQUE NOT NULL,
          description TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL,
          is_builtin  INTEGER NOT NULL DEFAULT 0,
          enabled     INTEGER NOT NULL DEFAULT 1,
          metadata    TEXT
        );

        CREATE INDEX idx_custom_workflows_name ON custom_workflows(name);
        CREATE INDEX idx_custom_workflows_enabled ON custom_workflows(enabled);

        -- Seed built-in workflows (task, done, ship, sync)
        INSERT INTO custom_workflows (name, description, is_builtin, enabled, created_at, updated_at)
        VALUES
          ('task', 'Start working on a task', 1, 1, datetime('now'), datetime('now')),
          ('done', 'Complete current task/subtask', 1, 1, datetime('now'), datetime('now')),
          ('ship', 'Ship feature with version bump and PR', 1, 1, datetime('now'), datetime('now')),
          ('sync', 'Analyze project and regenerate context', 1, 1, datetime('now'), datetime('now'));
      `)
    },
  },
  {
    version: 5,
    name: 'llm-analysis-table',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- LLM Analysis: Structured findings from hybrid sync pipeline
        -- Pipeline: CLI (collect) → LLM (analyze) → CLI (store)
        -- =======================================================================
        CREATE TABLE llm_analysis (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          commit_hash   TEXT,
          status        TEXT NOT NULL DEFAULT 'active',
          analysis      TEXT NOT NULL,
          analyzed_at   TEXT NOT NULL,
          superseded_at TEXT
        );

        CREATE INDEX idx_llm_analysis_status ON llm_analysis(status);
        CREATE INDEX idx_llm_analysis_commit ON llm_analysis(commit_hash);
      `)
    },
  },
  {
    version: 6,
    name: 'context-feedback-table',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Context Feedback: RL loop for file suggestion improvement
        -- Records suggested vs actual files per task for scoring boosts
        -- =======================================================================
        CREATE TABLE context_feedback (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id         TEXT NOT NULL,
          keywords        TEXT NOT NULL,
          suggested_files TEXT NOT NULL,
          actual_files    TEXT,
          precision       REAL,
          recall          REAL,
          created_at      TEXT NOT NULL,
          completed_at    TEXT
        );

        CREATE INDEX idx_cf_task ON context_feedback(task_id);
      `)
    },
  },
  {
    version: 7,
    name: 'sessions-table',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Sessions: Task lifecycle tracking (replaces current.json + archive/)
        -- =======================================================================
        CREATE TABLE sessions (
          id            TEXT PRIMARY KEY,
          project_id    TEXT NOT NULL,
          task          TEXT NOT NULL,
          status        TEXT NOT NULL,
          started_at    TEXT NOT NULL,
          paused_at     TEXT,
          completed_at  TEXT,
          duration      INTEGER NOT NULL DEFAULT 0,
          metrics       TEXT NOT NULL DEFAULT '{}',
          timeline      TEXT NOT NULL DEFAULT '[]'
        );

        CREATE INDEX idx_sessions_project ON sessions(project_id);
        CREATE INDEX idx_sessions_status ON sessions(status);
        CREATE INDEX idx_sessions_completed ON sessions(completed_at);
      `)
    },
  },
  {
    version: 8,
    name: 'task-token-tracking',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Token usage tracking per task (input + output)
        -- =======================================================================
        ALTER TABLE tasks ADD COLUMN tokens_in INTEGER DEFAULT 0;
        ALTER TABLE tasks ADD COLUMN tokens_out INTEGER DEFAULT 0;
      `)
    },
  },
]

// =============================================================================
// Database Manager
// =============================================================================

/** Max concurrent DB connections before evicting least-recently-used */
const MAX_DB_CONNECTIONS = 3

class PrjctDatabase {
  private connections = new Map<string, SqliteDatabase>()
  private accessOrder: string[] = []

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
  getDb(projectId: string): SqliteDatabase {
    const existing = this.connections.get(projectId)
    if (existing) {
      this.touchAccessOrder(projectId)
      return existing
    }

    // Evict LRU connection if at capacity
    if (this.connections.size >= MAX_DB_CONNECTIONS) {
      this.evictLru()
    }

    const dbPath = this.getDbPath(projectId)
    // Ensure parent directory exists before creating DB
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    const db = openDatabase(dbPath)

    // Enable WAL mode for concurrent reads + single writer
    db.run('PRAGMA journal_mode = WAL')

    // Performance tuning
    db.run('PRAGMA synchronous = NORMAL')
    db.run('PRAGMA cache_size = -2000') // 2MB cache
    db.run('PRAGMA temp_store = MEMORY')
    db.run('PRAGMA mmap_size = 33554432') // 32MB mmap

    // Run pending migrations
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

  /**
   * Move a projectId to the end of the access order (most recently used).
   */
  private touchAccessOrder(projectId: string): void {
    this.accessOrder = this.accessOrder.filter((id) => id !== projectId)
    this.accessOrder.push(projectId)
  }

  /**
   * Evict the least recently used database connection.
   */
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
    ...params: SqliteBindings[]
  ): T[] {
    const db = this.getDb(projectId)
    return db.prepare(sql).all(...params) as T[]
  }

  /**
   * Execute a raw SQL statement (INSERT/UPDATE/DELETE).
   */
  run(projectId: string, sql: string, ...params: SqliteBindings[]): void {
    const db = this.getDb(projectId)
    db.prepare(sql).run(...params)
  }

  /**
   * Execute a raw SQL query that returns a single row.
   */
  get<T = Record<string, unknown>>(
    projectId: string,
    sql: string,
    ...params: SqliteBindings[]
  ): T | null {
    const db = this.getDb(projectId)
    return (db.prepare(sql).get(...params) as T) ?? null
  }

  /**
   * Run multiple statements in a transaction.
   */
  transaction<T>(projectId: string, fn: (db: SqliteDatabase) => T): T {
    const db = this.getDb(projectId)
    return db.transaction(fn)(db)
  }

  // ===========================================================================
  // Migration System
  // ===========================================================================

  /**
   * Run all pending migrations.
   */
  private runMigrations(db: SqliteDatabase): void {
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
export type { SqliteDatabase, SqliteStatement, SqliteBindings }
