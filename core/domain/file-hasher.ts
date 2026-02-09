/**
 * File Hasher — Fast Content Hashing with SQLite Registry
 *
 * Computes content hashes for all project files and stores them in SQLite.
 * On subsequent syncs, compares current hashes against stored hashes
 * to identify added, modified, and deleted files.
 *
 * Uses Bun.hash (xxHash) for speed — <100ms for 500 files.
 *
 * @module domain/file-hasher
 * @version 1.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import prjctDb from '../storage/database'

// =============================================================================
// Types
// =============================================================================

export interface FileHash {
  path: string
  hash: string
  size: number
  mtime: string
}

export interface FileDiff {
  added: string[]
  modified: string[]
  deleted: string[]
  unchanged: string[]
}

export interface HashRegistry {
  files: Map<string, FileHash>
  builtAt: string
}

// =============================================================================
// Constants
// =============================================================================

const INDEXABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.scss',
  '.html',
  '.vue',
  '.svelte',
  '.py',
  '.go',
  '.rs',
  '.yaml',
  '.yml',
  '.toml',
])

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  '.cache',
  '.turbo',
  '.vercel',
  '.prjct',
])

// =============================================================================
// File Discovery
// =============================================================================

async function listProjectFiles(dir: string, projectPath: string): Promise<string[]> {
  const files: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])

  for (const entry of entries) {
    const name = String(entry.name)
    if (SKIP_DIRS.has(name)) continue
    if (name.startsWith('.') && name !== '.env.example') continue

    const fullPath = path.join(dir, name)
    if (entry.isDirectory()) {
      files.push(...(await listProjectFiles(fullPath, projectPath)))
    } else if (entry.isFile()) {
      const ext = path.extname(name).toLowerCase()
      if (INDEXABLE_EXTENSIONS.has(ext)) {
        files.push(path.relative(projectPath, fullPath))
      }
    }
  }
  return files
}

// =============================================================================
// Hashing
// =============================================================================

/**
 * Compute a fast hash of file content using Bun.hash (xxHash64).
 * Falls back to a simple checksum if Bun.hash is unavailable.
 */
function hashContent(content: string): string {
  // Bun.hash returns a bigint (xxHash64) — extremely fast
  if (typeof Bun !== 'undefined' && Bun.hash) {
    return `xxh64:${Bun.hash(content).toString(36)}`
  }
  // Fallback: simple FNV-1a 32-bit hash (still fast, no crypto overhead)
  let h = 0x811c9dc5
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `fnv1a:${(h >>> 0).toString(36)}`
}

/**
 * Compute hashes for all project files.
 * Processes files in parallel batches for speed.
 *
 * Performance target: <100ms for 500 files.
 */
export async function computeHashes(projectPath: string): Promise<Map<string, FileHash>> {
  const filePaths = await listProjectFiles(projectPath, projectPath)
  const hashes = new Map<string, FileHash>()

  const BATCH_SIZE = 100
  for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
    const batch = filePaths.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async (filePath) => {
        try {
          const fullPath = path.join(projectPath, filePath)
          const [content, stat] = await Promise.all([
            fs.readFile(fullPath, 'utf-8'),
            fs.stat(fullPath),
          ])
          return {
            path: filePath,
            hash: hashContent(content),
            size: stat.size,
            mtime: stat.mtime.toISOString(),
          } satisfies FileHash
        } catch {
          return null
        }
      })
    )

    for (const result of results) {
      if (result) {
        hashes.set(result.path, result)
      }
    }
  }

  return hashes
}

// =============================================================================
// Diff Detection
// =============================================================================

/**
 * Compare current file hashes against stored registry.
 * Returns lists of added, modified, deleted, and unchanged files.
 */
export function diffHashes(
  current: Map<string, FileHash>,
  stored: Map<string, FileHash>
): FileDiff {
  const added: string[] = []
  const modified: string[] = []
  const unchanged: string[] = []

  for (const [filePath, currentHash] of current) {
    const storedHash = stored.get(filePath)
    if (!storedHash) {
      added.push(filePath)
    } else if (storedHash.hash !== currentHash.hash) {
      modified.push(filePath)
    } else {
      unchanged.push(filePath)
    }
  }

  const deleted: string[] = []
  for (const filePath of stored.keys()) {
    if (!current.has(filePath)) {
      deleted.push(filePath)
    }
  }

  return { added, modified, deleted, unchanged }
}

// =============================================================================
// SQLite Persistence (uses index_checksums table)
// =============================================================================

/**
 * Save file hashes to SQLite index_checksums table.
 */
export function saveHashes(projectId: string, hashes: Map<string, FileHash>): void {
  const db = prjctDb.getDb(projectId)

  db.transaction(() => {
    // Clear existing checksums
    db.prepare('DELETE FROM index_checksums').run()

    // Insert all hashes
    const insert = db.prepare(
      'INSERT INTO index_checksums (path, checksum, size, mtime) VALUES (?, ?, ?, ?)'
    )

    for (const [, hash] of hashes) {
      insert.run(hash.path, hash.hash, hash.size, hash.mtime)
    }
  })()

  // Also store metadata about when hashes were computed
  prjctDb.setDoc(projectId, 'file-hashes-meta', {
    fileCount: hashes.size,
    builtAt: new Date().toISOString(),
  })
}

/**
 * Load file hashes from SQLite index_checksums table.
 */
export function loadHashes(projectId: string): Map<string, FileHash> {
  const hashes = new Map<string, FileHash>()

  try {
    const rows = prjctDb.query<{ path: string; checksum: string; size: number; mtime: string }>(
      projectId,
      'SELECT path, checksum, size, mtime FROM index_checksums'
    )

    for (const row of rows) {
      hashes.set(row.path, {
        path: row.path,
        hash: row.checksum,
        size: row.size || 0,
        mtime: row.mtime || '',
      })
    }
  } catch {
    // Table might not exist yet or be empty
  }

  return hashes
}

// =============================================================================
// High-level API
// =============================================================================

/**
 * Compute file hashes and diff against stored registry.
 * Returns the diff and the current hashes (for saving after sync completes).
 *
 * If no stored hashes exist (first sync), all files are "added".
 */
export async function detectChanges(
  projectPath: string,
  projectId: string
): Promise<{ diff: FileDiff; currentHashes: Map<string, FileHash> }> {
  const [currentHashes, storedHashes] = await Promise.all([
    computeHashes(projectPath),
    Promise.resolve(loadHashes(projectId)),
  ])

  const diff = diffHashes(currentHashes, storedHashes)

  return { diff, currentHashes }
}

/**
 * Check if a hash registry exists for this project.
 */
export function hasHashRegistry(projectId: string): boolean {
  return prjctDb.hasDoc(projectId, 'file-hashes-meta')
}
