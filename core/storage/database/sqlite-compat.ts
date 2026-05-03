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

/** Minimal prepared-statement interface shared by both drivers */
export interface SqliteStatement {
  get(...params: SqliteBindings[]): unknown
  all(...params: SqliteBindings[]): unknown[]
  run(...params: SqliteBindings[]): void
}

/** Minimal database interface shared by bun:sqlite and better-sqlite3 */
export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement
  run(sql: string): void
  close(): void
  transaction<T>(fn: (...args: SqliteDatabase[]) => T): (...args: SqliteDatabase[]) => T
}

/**
 * Open a SQLite database using the runtime-appropriate driver.
 * bun:sqlite on Bun, better-sqlite3 on Node.js.
 */
export function openDatabase(dbPath: string): SqliteDatabase {
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
