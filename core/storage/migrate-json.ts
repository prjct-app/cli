/**
 * JSON → SQLite Migration (PRJ-303)
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
 * @version 1.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import { isNotFoundError } from '../types/fs'
import type { MigrationResult } from '../types/storage.js'
import { prjctDb } from './database'

// =============================================================================
// File Definitions
// =============================================================================

/** Storage JSON files → kv_store keys */
const STORAGE_FILES: Array<{ filename: string; key: string }> = [
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
const INDEX_FILES: Array<{ filename: string; key: string }> = [
  { filename: 'project-index.json', key: 'project-index' },
  { filename: 'domains.json', key: 'domains' },
  { filename: 'categories-cache.json', key: 'categories-cache' },
]

// =============================================================================
// Main Migration Function
// =============================================================================

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
    // Check if already migrated (kv_store has data)
    if (prjctDb.exists(projectId) && prjctDb.hasDoc(projectId, 'state')) {
      result.success = true
      result.duration = Date.now() - start
      return result
    }

    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const storagePath = path.join(globalPath, 'storage')
    const indexPath = path.join(globalPath, 'index')
    const memoryPath = path.join(globalPath, 'memory')

    // Step 1: Create backup
    result.backupDir = await createBackup(storagePath, indexPath, memoryPath)

    // Step 2: Ensure DB is initialized (creates tables)
    prjctDb.getDb(projectId)

    // Step 3: Migrate storage JSON files → kv_store + normalized tables
    for (const { filename, key } of STORAGE_FILES) {
      const filePath = path.join(storagePath, filename)
      const data = await readJsonSafe(filePath)

      if (data === null) {
        result.skippedFiles.push(filename)
        continue
      }

      try {
        // Write to kv_store (document storage)
        prjctDb.setDoc(projectId, key, data)

        // Populate normalized tables
        populateNormalized(projectId, key, data)

        result.migratedFiles.push(filename)
      } catch (err) {
        result.errors.push({ file: filename, error: String(err) })
      }
    }

    // Step 4: Migrate index files → index_meta + normalized index tables
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

        // Populate normalized index tables
        populateIndexTables(projectId, key, data)

        result.migratedFiles.push(`index/${filename}`)
      } catch (err) {
        result.errors.push({ file: `index/${filename}`, error: String(err) })
      }
    }

    // Step 5: Migrate checksums.json → index_checksums table
    await migrateChecksums(projectId, indexPath, result)

    // Step 6: Migrate file-scores.json → index_files table
    await migrateFileScores(projectId, indexPath, result)

    // Step 7: Migrate events.jsonl → events table
    await migrateEventsJsonl(projectId, memoryPath, result)

    // Step 8: Migrate learnings.jsonl → memory table
    await migrateLearningsJsonl(projectId, memoryPath, result)

    // Step 9: Migrate session JSON files → sessions table
    const sessionsPath = path.join(globalPath, 'sessions')
    await migrateSessionFiles(projectId, sessionsPath, result)

    // Step 10: Clean up source JSON files (backup already exists)
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

// =============================================================================
// Backup
// =============================================================================

async function createBackup(
  storagePath: string,
  indexPath: string,
  memoryPath: string
): Promise<string> {
  const backupDir = path.join(storagePath, 'backup')
  await fs.mkdir(backupDir, { recursive: true })
  await fs.mkdir(path.join(backupDir, 'index'), { recursive: true })
  await fs.mkdir(path.join(backupDir, 'memory'), { recursive: true })

  // Backup storage files
  await copyFiles(
    storagePath,
    backupDir,
    (name) => name.endsWith('.json') || name.endsWith('.jsonl')
  )

  // Backup index files
  await copyFiles(indexPath, path.join(backupDir, 'index'))

  // Backup memory files
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

// =============================================================================
// Normalized Table Population
// =============================================================================

function populateNormalized(projectId: string, key: string, data: unknown): void {
  switch (key) {
    case 'state':
      populateTasksFromState(projectId, data as Record<string, unknown>)
      break
    case 'queue':
      populateQueueTasks(projectId, data as Record<string, unknown>)
      break
    case 'ideas':
      populateIdeas(projectId, data as Record<string, unknown>)
      break
    case 'shipped':
      populateShippedFeatures(projectId, data as Record<string, unknown>)
      break
    case 'metrics':
      populateMetricsDaily(projectId, data as Record<string, unknown>)
      break
    case 'analysis':
      populateAnalysis(projectId, data as Record<string, unknown>)
      break
  }
}

function populateTasksFromState(projectId: string, state: Record<string, unknown>): void {
  const db = prjctDb.getDb(projectId)

  const insertTask = db.prepare(`
    INSERT OR REPLACE INTO tasks
    (id, description, type, status, parent_description, branch, linear_id,
     linear_uuid, session_id, feature_id, started_at, completed_at,
     shipped_at, paused_at, pause_reason, pr_url, expected_value, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertSubtask = db.prepare(`
    INSERT OR REPLACE INTO subtasks
    (id, task_id, description, status, domain, agent, sort_order,
     depends_on, started_at, completed_at, output, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const migrateTask = (task: Record<string, unknown>, status?: string) => {
    if (!task || !task.id) return

    insertTask.run(
      toStr(task.id) ?? `task-${Date.now()}`,
      toStr(task.description ?? task.parentDescription) ?? '',
      toStr(task.type),
      toStr(status ?? task.status) ?? 'unknown',
      toStr(task.parentDescription),
      toStr(task.branch),
      toStr(task.linearId),
      toStr(task.linearUuid),
      toStr(task.sessionId),
      toStr(task.featureId),
      toStr(task.startedAt) ?? new Date().toISOString(),
      toStr(task.completedAt),
      toStr(task.shippedAt),
      toStr(task.pausedAt),
      toStr(task.pauseReason),
      toStr(task.prUrl),
      task.expectedValue ? JSON.stringify(task.expectedValue) : null,
      JSON.stringify(task)
    )

    // Migrate subtasks
    const subtasks = task.subtasks as Array<Record<string, unknown>> | undefined
    if (subtasks && Array.isArray(subtasks)) {
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i]
        insertSubtask.run(
          toStr(st.id) ?? `subtask-${i}`,
          toStr(task.id),
          toStr(st.description) ?? '',
          toStr(st.status) ?? 'pending',
          toStr(st.domain),
          toStr(st.agent),
          i,
          st.dependsOn ? JSON.stringify(st.dependsOn) : null,
          toStr(st.startedAt),
          toStr(st.completedAt),
          toStr(st.output),
          st.summary ? JSON.stringify(st.summary) : null
        )
      }
    }
  }

  if (state.currentTask) migrateTask(state.currentTask as Record<string, unknown>)
  if (state.previousTask) migrateTask(state.previousTask as Record<string, unknown>)

  const paused = state.pausedTasks as Array<Record<string, unknown>> | undefined
  if (paused && Array.isArray(paused)) {
    for (const task of paused) {
      migrateTask(task, 'paused')
    }
  }
}

function populateQueueTasks(projectId: string, data: Record<string, unknown>): void {
  const tasks = data.tasks as Array<Record<string, unknown>> | undefined
  if (!tasks || !Array.isArray(tasks)) return

  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO queue_tasks
    (id, description, type, priority, section, created_at, completed, completed_at,
     feature_id, feature_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const t of tasks) {
    stmt.run(
      toStr(t.id) ?? `queue-${Date.now()}`,
      toStr(t.description) ?? '',
      toStr(t.type),
      toStr(t.priority),
      toStr(t.section),
      toStr(t.createdAt) ?? new Date().toISOString(),
      t.completed ? 1 : 0,
      toStr(t.completedAt),
      toStr(t.featureId),
      toStr(t.featureName)
    )
  }
}

function populateIdeas(projectId: string, data: Record<string, unknown>): void {
  const ideas = data.ideas as Array<Record<string, unknown>> | undefined
  if (!ideas || !Array.isArray(ideas)) return

  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO ideas
    (id, text, status, priority, tags, added_at, converted_to, details, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const idea of ideas) {
    stmt.run(
      toStr(idea.id) ?? `idea-${Date.now()}`,
      toStr(idea.text) ?? '',
      toStr(idea.status) ?? 'pending',
      toStr(idea.priority) ?? 'medium',
      idea.tags ? JSON.stringify(idea.tags) : null,
      toStr(idea.addedAt) ?? new Date().toISOString(),
      toStr(idea.convertedTo),
      toStr(idea.details),
      JSON.stringify(idea)
    )
  }
}

function populateShippedFeatures(projectId: string, data: Record<string, unknown>): void {
  const shipped = data.shipped as Array<Record<string, unknown>> | undefined
  if (!shipped || !Array.isArray(shipped)) return

  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO shipped_features
    (id, name, shipped_at, version, description, type, duration, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const feature of shipped) {
    stmt.run(
      toStr(feature.id) ?? `ship-${Date.now()}`,
      toStr(feature.name) ?? '',
      toStr(feature.shippedAt) ?? new Date().toISOString(),
      toStr(feature.version) ?? '0.0.0',
      toStr(feature.description),
      toStr(feature.type),
      toStr(feature.duration),
      JSON.stringify(feature)
    )
  }
}

function populateMetricsDaily(projectId: string, data: Record<string, unknown>): void {
  const dailyStats = data.dailyStats as Array<Record<string, unknown>> | undefined
  if (!dailyStats || !Array.isArray(dailyStats)) return

  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO metrics_daily
    (date, tokens_saved, syncs, avg_compression_rate, total_duration)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const day of dailyStats) {
    stmt.run(
      toStr(day.date) ?? new Date().toISOString().slice(0, 10),
      toNum(day.tokensSaved) ?? 0,
      toNum(day.syncs) ?? 0,
      toNum(day.avgCompressionRate) ?? 0,
      toNum(day.totalDuration) ?? 0
    )
  }
}

function populateAnalysis(projectId: string, data: Record<string, unknown>): void {
  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO analysis
    (id, status, commit_hash, signature, sealed_at, analyzed_at, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const migrate = (analysis: Record<string, unknown>, id: string) => {
    if (!analysis) return
    stmt.run(
      id,
      toStr(analysis.status) ?? 'unknown',
      toStr(analysis.commitHash),
      toStr(analysis.signature),
      toStr(analysis.sealedAt),
      toStr(analysis.analyzedAt),
      JSON.stringify(analysis)
    )
  }

  if (data.draft) migrate(data.draft as Record<string, unknown>, 'draft')
  if (data.sealed) migrate(data.sealed as Record<string, unknown>, 'sealed')
}

// =============================================================================
// Index Table Population
// =============================================================================

function populateIndexTables(projectId: string, key: string, data: unknown): void {
  if (key === 'categories-cache') {
    populateCategoriesIndex(projectId, data as Record<string, unknown>)
  }
}

function populateCategoriesIndex(projectId: string, cache: Record<string, unknown>): void {
  const fileCategories = cache.fileCategories as Array<Record<string, unknown>> | undefined
  if (!fileCategories || !Array.isArray(fileCategories)) return

  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO index_files
    (path, categories, domain, score, size, mtime, language)
    VALUES (?, ?, ?, COALESCE((SELECT score FROM index_files WHERE path = ?), 0), NULL, NULL, NULL)
  `)

  for (const fc of fileCategories) {
    const p = toStr(fc.path)
    if (!p) continue
    stmt.run(p, fc.categories ? JSON.stringify(fc.categories) : null, toStr(fc.primaryDomain), p)
  }
}

// =============================================================================
// Specialized File Migrations
// =============================================================================

async function migrateChecksums(
  projectId: string,
  indexPath: string,
  result: MigrationResult
): Promise<void> {
  const filePath = path.join(indexPath, 'checksums.json')
  const data = await readJsonSafe(filePath)
  if (data === null) {
    result.skippedFiles.push('index/checksums.json')
    return
  }

  try {
    const checksums = (data as Record<string, unknown>).checksums as Record<string, string>
    if (!checksums) return

    const db = prjctDb.getDb(projectId)
    const stmt = db.prepare('INSERT OR REPLACE INTO index_checksums (path, checksum) VALUES (?, ?)')

    db.transaction(() => {
      for (const [filePath, checksum] of Object.entries(checksums)) {
        stmt.run(filePath, checksum)
      }
    })()

    result.migratedFiles.push('index/checksums.json')
  } catch (err) {
    result.errors.push({ file: 'index/checksums.json', error: String(err) })
  }
}

async function migrateFileScores(
  projectId: string,
  indexPath: string,
  result: MigrationResult
): Promise<void> {
  const filePath = path.join(indexPath, 'file-scores.json')
  const data = await readJsonSafe(filePath)
  if (data === null) {
    result.skippedFiles.push('index/file-scores.json')
    return
  }

  try {
    const scores = (data as Record<string, unknown>).scores as Array<Record<string, unknown>>
    if (!scores || !Array.isArray(scores)) return

    const db = prjctDb.getDb(projectId)
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO index_files
      (path, score, size, mtime, language, categories, domain)
      VALUES (?, ?, ?, ?, NULL,
        COALESCE((SELECT categories FROM index_files WHERE path = ?), NULL),
        COALESCE((SELECT domain FROM index_files WHERE path = ?), NULL))
    `)

    db.transaction(() => {
      for (const file of scores) {
        const p = toStr(file.path)
        if (!p) continue
        stmt.run(p, toNum(file.score) ?? 0, toNum(file.size), toStr(file.mtime), p, p)
      }
    })()

    result.migratedFiles.push('index/file-scores.json')
  } catch (err) {
    result.errors.push({ file: 'index/file-scores.json', error: String(err) })
  }
}

async function migrateEventsJsonl(
  projectId: string,
  memoryPath: string,
  result: MigrationResult
): Promise<void> {
  const filePath = path.join(memoryPath, 'events.jsonl')

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim())

    if (lines.length === 0) {
      result.skippedFiles.push('memory/events.jsonl')
      return
    }

    const db = prjctDb.getDb(projectId)
    const stmt = db.prepare(
      'INSERT INTO events (type, task_id, data, timestamp) VALUES (?, ?, ?, ?)'
    )

    db.transaction(() => {
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as Record<string, unknown>
          const type = toStr(event.type ?? event.action) ?? 'unknown'
          const taskId = toStr(event.taskId ?? event.task_id)
          const timestamp = toStr(event.timestamp ?? event.ts) ?? new Date().toISOString()
          stmt.run(type, taskId, line, timestamp)
        } catch {
          // Skip malformed lines
        }
      }
    })()

    result.migratedFiles.push('memory/events.jsonl')
  } catch (err) {
    if (isNotFoundError(err)) {
      result.skippedFiles.push('memory/events.jsonl')
    } else {
      result.errors.push({ file: 'memory/events.jsonl', error: String(err) })
    }
  }
}

async function migrateLearningsJsonl(
  projectId: string,
  memoryPath: string,
  result: MigrationResult
): Promise<void> {
  const filePath = path.join(memoryPath, 'learnings.jsonl')

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim())

    if (lines.length === 0) {
      result.skippedFiles.push('memory/learnings.jsonl')
      return
    }

    const db = prjctDb.getDb(projectId)
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO memory (key, domain, value, confidence, updated_at) VALUES (?, ?, ?, ?, ?)'
    )

    db.transaction(() => {
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as Record<string, unknown>
          const key = `learning:${toStr(entry.taskId ?? entry.timestamp) ?? Date.now()}`
          const tags = entry.tags as string[] | undefined
          const domain = tags && tags.length > 0 ? toStr(tags[0]) : null
          stmt.run(key, domain, line, 1.0, toStr(entry.timestamp) ?? new Date().toISOString())
        } catch {
          // Skip malformed lines
        }
      }
    })()

    result.migratedFiles.push('memory/learnings.jsonl')
  } catch (err) {
    if (isNotFoundError(err)) {
      result.skippedFiles.push('memory/learnings.jsonl')
    } else {
      result.errors.push({ file: 'memory/learnings.jsonl', error: String(err) })
    }
  }
}

// =============================================================================
// Session File Migration
// =============================================================================

async function migrateSessionFiles(
  projectId: string,
  sessionsPath: string,
  result: MigrationResult
): Promise<void> {
  const db = prjctDb.getDb(projectId)
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO sessions
    (id, project_id, task, status, started_at, paused_at, completed_at, duration, metrics, timeline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertSession = (session: Record<string, unknown>) => {
    if (!session || !session.id) return
    stmt.run(
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

  // Migrate current.json
  const currentPath = path.join(sessionsPath, 'current.json')
  const currentData = await readJsonSafe(currentPath)
  if (currentData !== null) {
    try {
      insertSession(currentData as Record<string, unknown>)
      result.migratedFiles.push('sessions/current.json')
      await fs.unlink(currentPath).catch(() => {})
    } catch (err) {
      result.errors.push({ file: 'sessions/current.json', error: String(err) })
    }
  }

  // Migrate archive/*.json files
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
          const filePath = path.join(monthDir, file)
          const data = await readJsonSafe(filePath)
          if (data !== null) {
            try {
              insertSession(data as Record<string, unknown>)
              result.migratedFiles.push(`sessions/archive/${month}/${file}`)
              await fs.unlink(filePath).catch(() => {})
            } catch (err) {
              result.errors.push({
                file: `sessions/archive/${month}/${file}`,
                error: String(err),
              })
            }
          }
        }
        // Remove empty month directory
        const remaining = await fs.readdir(monthDir)
        if (remaining.length === 0) {
          await fs.rmdir(monthDir).catch(() => {})
        }
      } catch {
        // Skip non-directory entries
      }
    }
    // Remove empty archive directory
    const remainingMonths = await fs.readdir(archiveDir).catch(() => [] as string[])
    if (remainingMonths.length === 0) {
      await fs.rmdir(archiveDir).catch(() => {})
    }
  } catch {
    // Archive dir doesn't exist — that's fine
  }

  // Remove empty sessions directory (only if no other files remain)
  try {
    const remaining = await fs.readdir(sessionsPath)
    if (remaining.length === 0) {
      await fs.rmdir(sessionsPath).catch(() => {})
    }
  } catch {
    // Already gone
  }
}

// =============================================================================
// JSON Cleanup (post-migration)
// =============================================================================

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

  // Delete storage JSON files (keep backup/ directory)
  for (const { filename } of STORAGE_FILES) {
    await deleteFile(path.join(storagePath, filename), `cleanup:${filename}`)
  }

  // Delete index JSON files
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

  // Delete memory JSONL files
  await deleteFile(path.join(memoryPath, 'events.jsonl'), 'cleanup:memory/events.jsonl')
  await deleteFile(path.join(memoryPath, 'learnings.jsonl'), 'cleanup:memory/learnings.jsonl')
}

// =============================================================================
// Binding Sanitizers
// =============================================================================

/** Coerce unknown JSON value to string | null safe for SQLite binding */
function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v)
  // Objects/arrays — stringify rather than crash
  return JSON.stringify(v)
}

/** Coerce unknown JSON value to number | null safe for SQLite binding */
function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }
  return null
}

// =============================================================================
// Helpers
// =============================================================================

async function readJsonSafe(filePath: string): Promise<unknown | null> {
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

// =============================================================================
// Legacy JSON Sweep (runs every sync)
// =============================================================================

/**
 * Sweep & destroy any leftover JSON files that should be in SQLite.
 *
 * Unlike migrateJsonToSqlite (which runs once), this runs on EVERY sync.
 * If old code or a failed migration left behind JSON files, this picks them
 * up, imports to SQLite, and deletes them.
 *
 * Also handles project.json at the globalPath root (now stored as kv_store 'project').
 */
export async function sweepLegacyJson(projectId: string): Promise<number> {
  const globalPath = pathManager.getGlobalProjectPath(projectId)
  const storagePath = path.join(globalPath, 'storage')
  let swept = 0

  // Ensure DB is ready
  prjctDb.getDb(projectId)

  // 1. Sweep storage/*.json files
  for (const { filename, key } of STORAGE_FILES) {
    const filePath = path.join(storagePath, filename)
    const data = await readJsonSafe(filePath)
    if (data === null) continue

    // Import to SQLite (overwrite — the JSON file is newer if it exists)
    prjctDb.setDoc(projectId, key, data)
    populateNormalized(projectId, key, data)

    // Delete the ghost
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
        // Remove empty month directory
        const remaining = await fs.readdir(monthDir)
        if (remaining.length === 0) await fs.rmdir(monthDir).catch(() => {})
      } catch {
        // skip
      }
    }
    // Remove empty archive directory
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
    // checksums.json and file-scores.json get handled by their specialized migrators
    // but we still delete them

    try {
      await fs.unlink(filePath)
    } catch {
      // ignore
    }
    swept++
  }

  return swept
}

export default migrateJsonToSqlite
