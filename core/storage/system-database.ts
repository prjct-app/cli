/**
 * System Database - Global SQLite DB for cross-project state
 *
 * Path: ~/.prjct-cli/system.db
 *
 * Stores system-wide state like MCP health status that isn't
 * tied to a specific project.
 *
 * @version 1.0.0
 */

import fs from 'node:fs'
import path from 'node:path'
import { isBun } from '../utils/runtime'

// =============================================================================
// SQLite Compatibility Layer (same pattern as database.ts)
// =============================================================================

type SqliteBindings = string | number | bigint | Buffer | null | undefined

interface SqliteStatement {
  get(...params: SqliteBindings[]): unknown
  all(...params: SqliteBindings[]): unknown[]
  run(...params: SqliteBindings[]): void
}

interface SqliteDatabase {
  prepare(sql: string): SqliteStatement
  run(sql: string): void
  close(): void
}

function openDatabase(dbPath: string): SqliteDatabase {
  if (isBun()) {
    const { Database } = require('bun:sqlite')
    return new Database(dbPath, { create: true }) as SqliteDatabase
  }
  const BetterSqlite3 = require('better-sqlite3')
  const db = new BetterSqlite3(dbPath)
  const origExec = db.exec.bind(db)
  db.run = (sql: string) => origExec(sql)
  return db as SqliteDatabase
}

// =============================================================================
// Types
// =============================================================================

export interface McpHealthRow {
  provider: string
  status: 'healthy' | 'unhealthy' | 'unconfigured'
  last_checked: string
  last_error: string | null
  token_version: string | null
  config_valid: number
  oauth_valid: number
  updated_at: string
}

export interface McpHealthStatus {
  status: 'healthy' | 'unhealthy' | 'unconfigured'
  lastError?: string | null
  tokenVersion?: string | null
  configValid?: boolean
  oauthValid?: boolean
}

// =============================================================================
// System Database
// =============================================================================

class SystemDatabase {
  private db: SqliteDatabase | null = null
  private dbPath: string

  constructor() {
    const envOverride = process.env.PRJCT_CLI_HOME?.trim()
    const globalBaseDir = envOverride
      ? path.resolve(envOverride)
      : path.join(require('node:os').homedir(), '.prjct-cli')
    this.dbPath = path.join(globalBaseDir, 'system.db')
  }

  private getDb(): SqliteDatabase {
    if (this.db) return this.db

    const dbDir = path.dirname(this.dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    const db = openDatabase(this.dbPath)

    db.run('PRAGMA journal_mode = WAL')
    db.run('PRAGMA synchronous = NORMAL')
    db.run('PRAGMA cache_size = -1000')
    db.run('PRAGMA temp_store = MEMORY')

    this.runMigrations(db)
    this.db = db
    return db
  }

  private runMigrations(db: SqliteDatabase): void {
    db.run(`
      CREATE TABLE IF NOT EXISTS _system_migrations (
        version     INTEGER PRIMARY KEY,
        name        TEXT NOT NULL,
        applied_at  TEXT NOT NULL
      )
    `)

    const applied = new Set(
      (
        db.prepare('SELECT version FROM _system_migrations').all() as Array<{ version: number }>
      ).map((r) => r.version)
    )

    const migrations = [
      {
        version: 1,
        name: 'mcp-health-table',
        up: (d: SqliteDatabase) => {
          d.run(`
            CREATE TABLE mcp_health (
              provider      TEXT PRIMARY KEY,
              status        TEXT NOT NULL,
              last_checked  TEXT NOT NULL,
              last_error    TEXT,
              token_version TEXT,
              config_valid  INTEGER NOT NULL DEFAULT 0,
              oauth_valid   INTEGER NOT NULL DEFAULT 0,
              updated_at    TEXT NOT NULL
            )
          `)
        },
      },
    ]

    for (const migration of migrations) {
      if (applied.has(migration.version)) continue
      migration.up(db)
      db.prepare('INSERT INTO _system_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        migration.version,
        migration.name,
        new Date().toISOString()
      )
    }
  }

  // ===========================================================================
  // MCP Health
  // ===========================================================================

  getMcpHealth(provider: string): McpHealthRow | null {
    const db = this.getDb()
    return (
      (db.prepare('SELECT * FROM mcp_health WHERE provider = ?').get(provider) as McpHealthRow) ??
      null
    )
  }

  setMcpHealth(provider: string, status: McpHealthStatus): void {
    const db = this.getDb()
    const now = new Date().toISOString()
    db.prepare(`
      INSERT OR REPLACE INTO mcp_health
        (provider, status, last_checked, last_error, token_version, config_valid, oauth_valid, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      provider,
      status.status,
      now,
      status.lastError ?? null,
      status.tokenVersion ?? null,
      status.configValid ? 1 : 0,
      status.oauthValid ? 1 : 0,
      now
    )
  }

  clearMcpHealth(provider: string): void {
    const db = this.getDb()
    db.prepare('DELETE FROM mcp_health WHERE provider = ?').run(provider)
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const systemDb = new SystemDatabase()
export default systemDb
export { SystemDatabase }
