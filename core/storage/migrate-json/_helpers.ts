/**
 * Shared sanitizers + safe JSON reader for the JSON→SQLite migration.
 */

import fs from 'node:fs/promises'
import { isNotFoundError } from '../../types/fs'

/** Coerce unknown JSON value to string | null safe for SQLite binding */
export function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v)
  // Objects/arrays — stringify rather than crash
  return JSON.stringify(v)
}

/** Coerce unknown JSON value to number | null safe for SQLite binding */
export function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }
  return null
}

export async function readJsonSafe(filePath: string): Promise<unknown | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    if (isNotFoundError(err) || err instanceof SyntaxError) {
      return null
    }
    throw err
  }
}

/** Storage JSON files → kv_store keys */
export const STORAGE_FILES: Array<{ filename: string; key: string }> = [
  { filename: 'state.json', key: 'state' },
  { filename: 'queue.json', key: 'queue' },
  { filename: 'ideas.json', key: 'ideas' },
  { filename: 'shipped.json', key: 'shipped' },
  { filename: 'metrics.json', key: 'metrics' },
  { filename: 'velocity.json', key: 'velocity' },
  { filename: 'analysis.json', key: 'analysis' },
  { filename: 'roadmap.json', key: 'roadmap' },
  { filename: 'session.json', key: 'session' },
  { filename: 'issues.json', key: 'issues' },
]

/** Index JSON files → index_meta keys */
export const INDEX_FILES: Array<{ filename: string; key: string }> = [
  { filename: 'project-index.json', key: 'project-index' },
  { filename: 'domains.json', key: 'domains' },
  { filename: 'categories-cache.json', key: 'categories-cache' },
]
