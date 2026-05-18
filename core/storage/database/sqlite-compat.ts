/**
 * SQLite Compatibility Layer (bun:sqlite + better-sqlite3)
 *
 * Both drivers share most of the API; we just patch `run` onto
 * better-sqlite3 (which uses `exec` for raw SQL) so callers can stay
 * runtime-agnostic.
 */

import { isBun } from '../../utils/runtime'

/** Bind parameter types accepted by both drivers */
export type SqliteBindings = string | number | bigint | Buffer | null | undefined

/**
 * Result of executing a prepared statement that mutates rows.
 * Both bun:sqlite and better-sqlite3 return this shape natively from
 * `Statement.run(...)`; the wrapper previously discarded it. Required
 * by the optimistic-CAS path in spec-storage (`UPDATE … WHERE updated_at=?`
 * only succeeds when `changes === 1`).
 */
export interface SqliteRunResult {
  changes: number
}

/** Minimal prepared-statement interface shared by both drivers */
export interface SqliteStatement {
  get(...params: SqliteBindings[]): unknown
  all(...params: SqliteBindings[]): unknown[]
  run(...params: SqliteBindings[]): SqliteRunResult
}

/**
 * A transaction wrapper. Both bun:sqlite and better-sqlite3 return a callable
 * that ALSO carries `.deferred`/`.immediate`/`.exclusive` variants. Default
 * (calling it directly) is DEFERRED — the write lock is only taken at the
 * first write, so two concurrent writers can both enter and then collide,
 * aborting one MID-transaction on SQLITE_BUSY. `.immediate` takes the write
 * lock up front: contention fails fast/predictably (or waits out
 * busy_timeout), never mid-write.
 */
export interface SqliteTransaction<T> {
  (...args: SqliteDatabase[]): T
  deferred: (...args: SqliteDatabase[]) => T
  immediate: (...args: SqliteDatabase[]) => T
  exclusive: (...args: SqliteDatabase[]) => T
}

/** Minimal database interface shared by bun:sqlite and better-sqlite3 */
export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement
  run(sql: string): void
  close(): void
  transaction<T>(fn: (...args: SqliteDatabase[]) => T): SqliteTransaction<T>
}

/**
 * Open a SQLite database using the runtime-appropriate driver.
 * bun:sqlite on Bun, better-sqlite3 on Node.js.
 *
 * Every connection is opened with the correctness PRAGMAs baked in:
 *   - journal_mode = WAL       — concurrent reads + single writer
 *   - busy_timeout = 5000      — wait on lock contention instead of hanging
 *                                silently when the daemon holds an overlapping
 *                                connection (see [[gotcha_sync_hang]])
 *
 * Performance-tuning PRAGMAs (synchronous, cache_size, mmap_size, …) remain
 * the caller's responsibility — they differ per database (per-project vs
 * system) and aren't correctness-critical.
 */
export function openDatabase(dbPath: string): SqliteDatabase {
  const db = openRaw(dbPath)
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA busy_timeout = 5000')
  return db
}

function openRaw(dbPath: string): SqliteDatabase {
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
