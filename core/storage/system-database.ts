/**
 * System Database - Global SQLite DB for cross-project state
 *
 * Path: ~/.prjct-cli/system.db
 *
 * Stores system-wide state like MCP health status that isn't
 * tied to a specific project.
 *
 */

import fs from 'node:fs'
import path from 'node:path'
import { resolveCliHome } from '../infrastructure/cli-home'
import type { McpHealthRow, McpHealthStatus } from '../types/storage/extended'
import { openDatabase, type SqliteDatabase } from './database/sqlite-compat'

// System Database

class SystemDatabase {
  private db: SqliteDatabase | null = null
  private dbPath: string

  constructor() {
    // Lazy-resolved shared definition — honors PRJCT_CLI_HOME (cli-home.ts).
    this.dbPath = path.join(resolveCliHome(), 'system.db')
  }

  private getDb(): SqliteDatabase {
    if (this.db) return this.db

    const dbDir = path.dirname(this.dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    // openDatabase bakes in WAL + busy_timeout=5000 (daemon-safety pragmas).
    const db = openDatabase(this.dbPath)

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

  // MCP Health

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

// Singleton Export

export const systemDb = new SystemDatabase()
export default systemDb
export { SystemDatabase }
