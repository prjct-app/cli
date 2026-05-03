/**
 * Specialized migrators for files that don't fit the kv_store pattern:
 * checksums, file scores, events.jsonl, learnings.jsonl, and session
 * snapshots. Each appends to its dedicated SQL table.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { isNotFoundError } from '../../types/fs'
import type { MigrationResult } from '../../types/storage/extended'
import { prjctDb } from '../database'
import { readJsonSafe, toNum, toStr } from './_helpers'

export async function migrateChecksums(
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

export async function migrateFileScores(
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

export async function migrateEventsJsonl(
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

export async function migrateLearningsJsonl(
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

export async function migrateSessionFiles(
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
