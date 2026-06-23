/**
 * JSON → SQLite Migration (PRJ-303).
 *
 * **DEPRECATED — scheduled removal in v3.0.** The JSON layout shipped
 * pre-v1.24.1; every v2.x install has long since migrated. Skip the
 * call entirely with `PRJCT_SKIP_JSON_MIGRATION=1` (honored in
 * sync-service). When this file goes away in v3.0, the gate and the
 * matching imports in update.ts / sync-service.ts go with it.
 *
 * One-time migration: reads existing JSON/JSONL files and inserts into SQLite.
 * Creates backup of original files before migration.
 *
 * Migration flow:
 * 1. Check if prjct.db already exists → skip if so
 * 2. Backup all JSON files to storage/backup/
 * 3. Insert documents into kv_store (backward-compatible)
 * 4. Populate normalized tables for indexed queries
 * 5. Migrate events.jsonl → events table
 * 6. Migrate index files → index tables
 *
 * Auto-runs on first StorageManager access when prjct.db doesn't exist.
 *
 */

import { existsSync, readdirSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import { isNotFoundError } from '../types/fs'
import type { MigrationResult } from '../types/storage/extended'
import { prjctDb } from './database'
import { INDEX_FILES, readJsonSafe, STORAGE_FILES, toNum, toStr } from './migrate-json/_helpers'
import {
  migrateChecksums,
  migrateEventsJsonl,
  migrateFileScores,
  migrateLearningsJsonl,
  migrateSessionFiles,
} from './migrate-json/migrate-files'
import { populateIndexTables, populateNormalized } from './migrate-json/populate-tables'

/** Legacy index/memory files outside STORAGE_FILES/INDEX_FILES that the
 *  migration also reads. Kept here so `hasLegacyArtifacts` checks the exact
 *  same set the migration consumes. */
const LEGACY_INDEX_EXTRA = ['checksums.json', 'file-scores.json']
const LEGACY_MEMORY_FILES = ['events.jsonl', 'learnings.jsonl']

function hasLegacySessionArtifacts(sessionsPath: string): boolean {
  if (existsSync(path.join(sessionsPath, 'current.json'))) return true

  const archiveDir = path.join(sessionsPath, 'archive')
  try {
    for (const month of readdirSync(archiveDir, { withFileTypes: true })) {
      if (!month.isDirectory()) continue
      try {
        const monthDir = path.join(archiveDir, month.name)
        if (readdirSync(monthDir).some((file) => file.endsWith('.json'))) return true
      } catch {
        // Ignore unreadable archive subdirs; the migration will surface them
        // only when another concrete legacy artifact requires a migration pass.
      }
    }
  } catch {
    // No archive dir, or unreadable archive dir without a concrete JSON file.
  }

  return false
}

/**
 * Fast filesystem check: does this project still have ANY legacy JSON/JSONL
 * artifact the migration would read? A successful migration deletes them
 * (`cleanupJsonFiles`), so their absence means the project is already on
 * SQLite — and we can skip WITHOUT opening its database.
 *
 * This is the hot guard for `prjct update`, which calls the migration for
 * EVERY project. On heavy users (tens of thousands of projects) the old
 * `prjctDb.hasDoc()` early-return opened each project's DB just to confirm
 * it was migrated — WAL + SHM + mmap per open, plus a migration pass and a
 * VACUUM-INTO backup — exhausting file descriptors (EMFILE) and taking
 * minutes. Pure `existsSync` stats here: no FDs held, no DB touched.
 */
export function hasLegacyArtifacts(projectId: string): boolean {
  const globalPath = pathManager.getGlobalProjectPath(projectId)
  const storagePath = path.join(globalPath, 'storage')
  const indexPath = path.join(globalPath, 'index')
  const memoryPath = path.join(globalPath, 'memory')

  for (const { filename } of STORAGE_FILES) {
    if (existsSync(path.join(storagePath, filename))) return true
  }
  for (const { filename } of INDEX_FILES) {
    if (existsSync(path.join(indexPath, filename))) return true
  }
  for (const filename of LEGACY_INDEX_EXTRA) {
    if (existsSync(path.join(indexPath, filename))) return true
  }
  for (const filename of LEGACY_MEMORY_FILES) {
    if (existsSync(path.join(memoryPath, filename))) return true
  }
  // sessions/current.json + sessions/archive/*/*.json are migrated via
  // migrateSessionFiles. A plain sessions/ directory is modern structure,
  // not legacy; do not open the DB just because it exists.
  const sessionsPath = path.join(globalPath, 'sessions')
  if (hasLegacySessionArtifacts(sessionsPath)) return true

  return false
}

/**
 * Migrate all JSON files to SQLite for a project.
 * Safe to call multiple times — skips if DB already has data.
 */
export async function migrateJsonToSqlite(projectId: string): Promise<MigrationResult> {
  const start = Date.now()
  const result: MigrationResult = {
    success: false,
    migratedFiles: [],
    skippedFiles: [],
    errors: [],
    backupDir: null,
    duration: 0,
  }

  try {
    // Already migrated
    if (prjctDb.exists(projectId) && prjctDb.hasDoc(projectId, 'state')) {
      result.success = true
      result.duration = Date.now() - start
      return result
    }

    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const storagePath = path.join(globalPath, 'storage')
    const indexPath = path.join(globalPath, 'index')
    const memoryPath = path.join(globalPath, 'memory')

    result.backupDir = await createBackup(storagePath, indexPath, memoryPath)

    // Ensure DB is initialized (creates tables)
    prjctDb.getDb(projectId)

    // Storage JSON files → kv_store + normalized tables
    for (const { filename, key } of STORAGE_FILES) {
      const filePath = path.join(storagePath, filename)
      const data = await readJsonSafe(filePath)

      if (data === null) {
        result.skippedFiles.push(filename)
        continue
      }

      try {
        prjctDb.setDoc(projectId, key, data)
        populateNormalized(projectId, key, data)
        result.migratedFiles.push(filename)
      } catch (err) {
        result.errors.push({ file: filename, error: String(err) })
      }
    }

    // Index files → index_meta + normalized index tables
    for (const { filename, key } of INDEX_FILES) {
      const filePath = path.join(indexPath, filename)
      const data = await readJsonSafe(filePath)

      if (data === null) {
        result.skippedFiles.push(`index/${filename}`)
        continue
      }

      try {
        prjctDb.run(
          projectId,
          'INSERT OR REPLACE INTO index_meta (key, data, updated_at) VALUES (?, ?, ?)',
          key,
          JSON.stringify(data),
          new Date().toISOString()
        )
        populateIndexTables(projectId, key, data)
        result.migratedFiles.push(`index/${filename}`)
      } catch (err) {
        result.errors.push({ file: `index/${filename}`, error: String(err) })
      }
    }

    await migrateChecksums(projectId, indexPath, result)
    await migrateFileScores(projectId, indexPath, result)
    await migrateEventsJsonl(projectId, memoryPath, result)
    await migrateLearningsJsonl(projectId, memoryPath, result)

    const sessionsPath = path.join(globalPath, 'sessions')
    await migrateSessionFiles(projectId, sessionsPath, result)

    if (result.errors.length === 0) {
      await cleanupJsonFiles(storagePath, indexPath, memoryPath, result)
    }

    result.success = result.errors.length === 0
    result.duration = Date.now() - start
    return result
  } catch (err) {
    result.errors.push({ file: '<migration>', error: String(err) })
    result.duration = Date.now() - start
    return result
  }
}

async function createBackup(
  storagePath: string,
  indexPath: string,
  memoryPath: string
): Promise<string> {
  const backupDir = path.join(storagePath, 'backup')
  await fs.mkdir(backupDir, { recursive: true })
  await fs.mkdir(path.join(backupDir, 'index'), { recursive: true })
  await fs.mkdir(path.join(backupDir, 'memory'), { recursive: true })

  await copyFiles(
    storagePath,
    backupDir,
    (name) => name.endsWith('.json') || name.endsWith('.jsonl')
  )
  await copyFiles(indexPath, path.join(backupDir, 'index'))
  await copyFiles(memoryPath, path.join(backupDir, 'memory'))

  return backupDir
}

async function copyFiles(
  srcDir: string,
  destDir: string,
  filter?: (name: string) => boolean
): Promise<void> {
  try {
    const entries = await fs.readdir(srcDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (filter && !filter(entry.name)) continue
      const src = path.join(srcDir, entry.name)
      const dest = path.join(destDir, entry.name)
      await fs.copyFile(src, dest)
    }
  } catch (err) {
    if (!isNotFoundError(err)) throw err
  }
}

/**
 * Delete source JSON/JSONL files after successful migration.
 * Keeps backup/ directory and context/*.md files intact.
 */
async function cleanupJsonFiles(
  storagePath: string,
  indexPath: string,
  memoryPath: string,
  result: MigrationResult
): Promise<void> {
  const deleteFile = async (filePath: string, label: string) => {
    try {
      await fs.unlink(filePath)
    } catch (err) {
      if (!isNotFoundError(err)) {
        result.errors.push({ file: label, error: `cleanup: ${String(err)}` })
      }
    }
  }

  for (const { filename } of STORAGE_FILES) {
    await deleteFile(path.join(storagePath, filename), `cleanup:${filename}`)
  }

  const indexFiles = [
    'project-index.json',
    'domains.json',
    'categories-cache.json',
    'checksums.json',
    'file-scores.json',
  ]
  for (const filename of indexFiles) {
    await deleteFile(path.join(indexPath, filename), `cleanup:index/${filename}`)
  }

  await deleteFile(path.join(memoryPath, 'events.jsonl'), 'cleanup:memory/events.jsonl')
  await deleteFile(path.join(memoryPath, 'learnings.jsonl'), 'cleanup:memory/learnings.jsonl')
}

// Legacy JSON Sweep (runs every sync)

/**
 * Sweep & destroy any leftover JSON files that should be in SQLite.
 *
 * Unlike migrateJsonToSqlite (which runs once), this runs on EVERY sync.
 * If old code or a failed migration left behind JSON files, this picks them
 * up, imports to SQLite, and deletes them.
 */
export async function sweepLegacyJson(projectId: string): Promise<number> {
  const globalPath = pathManager.getGlobalProjectPath(projectId)
  const storagePath = path.join(globalPath, 'storage')
  let swept = 0

  prjctDb.getDb(projectId)

  // 1. Sweep storage/*.json files
  for (const { filename, key } of STORAGE_FILES) {
    const filePath = path.join(storagePath, filename)
    const data = await readJsonSafe(filePath)
    if (data === null) continue

    prjctDb.setDoc(projectId, key, data)
    populateNormalized(projectId, key, data)

    try {
      await fs.unlink(filePath)
    } catch {
      // Already gone or permission issue — don't care
    }
    swept++
  }

  // 2. Sweep project.json at globalPath root
  const projectJsonPath = path.join(globalPath, 'project.json')
  const projectData = await readJsonSafe(projectJsonPath)
  if (projectData !== null) {
    prjctDb.setDoc(projectId, 'project', projectData)
    try {
      await fs.unlink(projectJsonPath)
    } catch {
      // ignore
    }
    swept++
  }

  // 3. Sweep memory/*.jsonl files
  const memoryPath = path.join(globalPath, 'memory')
  for (const jsonlFile of ['events.jsonl', 'learnings.jsonl']) {
    const filePath = path.join(memoryPath, jsonlFile)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n').filter((l) => l.trim())
      if (lines.length === 0) {
        await fs.unlink(filePath)
        swept++
        continue
      }

      const db = prjctDb.getDb(projectId)
      if (jsonlFile === 'events.jsonl') {
        const stmt = db.prepare(
          'INSERT INTO events (type, task_id, data, timestamp) VALUES (?, ?, ?, ?)'
        )
        db.transaction(() => {
          for (const line of lines) {
            try {
              const event = JSON.parse(line) as Record<string, unknown>
              stmt.run(
                toStr(event.type ?? event.action) ?? 'unknown',
                toStr(event.taskId ?? event.task_id),
                line,
                toStr(event.timestamp ?? event.ts) ?? new Date().toISOString()
              )
            } catch {
              // skip malformed
            }
          }
        })()
      } else {
        const stmt = db.prepare(
          'INSERT OR REPLACE INTO memory (key, domain, value, confidence, updated_at) VALUES (?, ?, ?, ?, ?)'
        )
        db.transaction(() => {
          for (const line of lines) {
            try {
              const entry = JSON.parse(line) as Record<string, unknown>
              const key = `learning:${toStr(entry.taskId ?? entry.timestamp) ?? Date.now()}`
              const tags = entry.tags as string[] | undefined
              stmt.run(
                key,
                toStr(tags?.[0]),
                line,
                1.0,
                toStr(entry.timestamp) ?? new Date().toISOString()
              )
            } catch {
              // skip malformed
            }
          }
        })()
      }

      await fs.unlink(filePath)
      swept++
    } catch {
      // File doesn't exist — good
    }
  }

  // 4. Sweep sessions/ JSON files (current.json + archive/*.json)
  const sessionsPath = path.join(globalPath, 'sessions')
  const sessionInsert = (session: Record<string, unknown>) => {
    if (!session || !session.id) return
    const db = prjctDb.getDb(projectId)
    db.prepare(`
      INSERT OR IGNORE INTO sessions
      (id, project_id, task, status, started_at, paused_at, completed_at, duration, metrics, timeline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      toStr(session.id),
      toStr(session.projectId) ?? projectId,
      toStr(session.task) ?? '',
      toStr(session.status) ?? 'completed',
      toStr(session.startedAt) ?? new Date().toISOString(),
      toStr(session.pausedAt),
      toStr(session.completedAt),
      toNum(session.duration) ?? 0,
      session.metrics ? JSON.stringify(session.metrics) : '{}',
      session.timeline ? JSON.stringify(session.timeline) : '[]'
    )
  }

  // 4a. Sweep current.json
  const currentJsonPath = path.join(sessionsPath, 'current.json')
  const currentSessionData = await readJsonSafe(currentJsonPath)
  if (currentSessionData !== null) {
    sessionInsert(currentSessionData as Record<string, unknown>)
    await fs.unlink(currentJsonPath).catch(() => {})
    swept++
  }

  // 4b. Sweep archive/*.json
  const archiveDir = path.join(sessionsPath, 'archive')
  try {
    const months = await fs.readdir(archiveDir)
    for (const month of months) {
      const monthDir = path.join(archiveDir, month)
      try {
        const stat = await fs.stat(monthDir)
        if (!stat.isDirectory()) continue
        const files = await fs.readdir(monthDir)
        for (const file of files) {
          if (!file.endsWith('.json')) continue
          const data = await readJsonSafe(path.join(monthDir, file))
          if (data !== null) {
            sessionInsert(data as Record<string, unknown>)
            await fs.unlink(path.join(monthDir, file)).catch(() => {})
            swept++
          }
        }
        const remaining = await fs.readdir(monthDir)
        if (remaining.length === 0) await fs.rmdir(monthDir).catch(() => {})
      } catch {
        // skip
      }
    }
    const remainingMonths = await fs.readdir(archiveDir).catch(() => [] as string[])
    if (remainingMonths.length === 0) await fs.rmdir(archiveDir).catch(() => {})
  } catch {
    // archive dir doesn't exist
  }

  // 4c. Remove empty sessions directory
  try {
    const remaining = await fs.readdir(sessionsPath)
    if (remaining.length === 0) await fs.rmdir(sessionsPath).catch(() => {})
  } catch {
    // already gone
  }

  // 5. Sweep index/*.json files
  const indexPath = path.join(globalPath, 'index')
  const allIndexFiles = [
    ...INDEX_FILES.map((f) => f.filename),
    'checksums.json',
    'file-scores.json',
  ]
  for (const filename of allIndexFiles) {
    const filePath = path.join(indexPath, filename)
    const data = await readJsonSafe(filePath)
    if (data === null) continue

    const indexFile = INDEX_FILES.find((f) => f.filename === filename)
    if (indexFile) {
      prjctDb.run(
        projectId,
        'INSERT OR REPLACE INTO index_meta (key, data, updated_at) VALUES (?, ?, ?)',
        indexFile.key,
        JSON.stringify(data),
        new Date().toISOString()
      )
      populateIndexTables(projectId, indexFile.key, data)
    }
    // checksums.json and file-scores.json get handled by their specialized
    // migrators but we still delete them

    try {
      await fs.unlink(filePath)
    } catch {
      // ignore
    }
    swept++
  }

  return swept
}
