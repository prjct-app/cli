import path from 'node:path'
import { getErrorMessage } from '../types/fs'
import * as dateHelper from './date-helper'
import * as fileHelper from './file-helper'
import * as jsonlHelper from './jsonl-helper'

/**
 * Session Helper - High-level session operations
 *
 * Simplifies common session workflows by combining:
 * - date-helper (date formatting)
 * - jsonl-helper (JSONL parsing)
 * - file-helper (file operations)
 * - path-manager (path construction)
 */

interface SessionEntry {
  ts?: string
  timestamp?: string
  type?: string
  [key: string]: unknown
}

interface SessionStats {
  totalEntries: number
  byType: Record<string, number>
  byDate: Record<string, number>
  activeDays: number
  averagePerDay: number
}

interface ArchiveResult {
  archived: number
  files: string[]
  errors: Array<{ filename: string; error: string }>
}

/**
 * Build session file path for today
 */
export function getTodaySessionFilePath(
  projectGlobalPath: string,
  layer: string,
  filename: string | null = null
): string {
  const today = dateHelper.getTodayKey()
  const yearMonth = dateHelper.formatMonth(new Date())
  const [year, month] = yearMonth.split('-')

  const sessionDir = path.join(projectGlobalPath, layer, 'sessions', year, month)

  if (filename) {
    return path.join(sessionDir, filename)
  }

  return path.join(sessionDir, `${today}.jsonl`)
}

/**
 * Ensure today's session directory exists
 */
export async function ensureTodaySessionDir(
  projectGlobalPath: string,
  layer: string
): Promise<string> {
  const yearMonth = dateHelper.formatMonth(new Date())
  const [year, month] = yearMonth.split('-')

  const sessionDir = path.join(projectGlobalPath, layer, 'sessions', year, month)
  await fileHelper.ensureDir(sessionDir)

  return sessionDir
}

/**
 * Write log entry to today's session
 */
export async function writeToSession(
  projectGlobalPath: string,
  layer: string,
  entry: SessionEntry,
  filename: string | null = null
): Promise<void> {
  await ensureTodaySessionDir(projectGlobalPath, layer)

  const filePath = getTodaySessionFilePath(projectGlobalPath, layer, filename)

  // Add timestamp if not present
  if (!entry.ts && !entry.timestamp) {
    entry.ts = dateHelper.getTimestamp()
  }

  await jsonlHelper.appendJsonLine(filePath, entry)
}

/**
 * Read today's session logs
 */
export async function readTodaySession<T = SessionEntry>(
  projectGlobalPath: string,
  layer: string,
  filename: string | null = null
): Promise<T[]> {
  const filePath = getTodaySessionFilePath(projectGlobalPath, layer, filename)
  return await jsonlHelper.readJsonLines<T>(filePath)
}

/**
 * Read session logs for a date range
 */
export async function readRecentSessions<T = SessionEntry>(
  projectGlobalPath: string,
  layer: string,
  daysBack = 7
): Promise<T[]> {
  const fromDate = dateHelper.getDaysAgo(daysBack)
  const toDate = new Date()

  const dates = dateHelper.getDateRange(fromDate, toDate)
  const allEntries: T[] = []

  for (const date of dates) {
    const yearMonth = dateHelper.formatMonth(date)
    const dateKey = dateHelper.getDateKey(date)
    const [year, month] = yearMonth.split('-')

    const filePath = path.join(
      projectGlobalPath,
      layer,
      'sessions',
      year,
      month,
      `${dateKey}.jsonl`
    )

    const entries = await jsonlHelper.readJsonLines<T>(filePath)
    allEntries.push(...entries)
  }

  return allEntries
}

/**
 * Get session statistics for a layer
 */
export async function getSessionStats(
  projectGlobalPath: string,
  layer: string,
  daysBack = 30
): Promise<SessionStats> {
  const entries = await readRecentSessions<SessionEntry>(projectGlobalPath, layer, daysBack)

  // Group by type
  const byType: Record<string, number> = {}
  for (const entry of entries) {
    const type = entry.type || 'unknown'
    byType[type] = (byType[type] || 0) + 1
  }

  // Group by date
  const byDate: Record<string, number> = {}
  for (const entry of entries) {
    const timestamp = entry.ts || entry.timestamp
    if (timestamp) {
      const date = dateHelper.getDateKey(new Date(timestamp))
      byDate[date] = (byDate[date] || 0) + 1
    }
  }

  return {
    totalEntries: entries.length,
    byType,
    byDate,
    activeDays: Object.keys(byDate).length,
    averagePerDay: entries.length / Math.max(daysBack, 1),
  }
}

/**
 * Archive old session data (move sessions older than N days)
 */
export async function archiveOldSessions(
  projectGlobalPath: string,
  layer: string,
  daysToKeep = 30
): Promise<ArchiveResult> {
  const cutoffDate = dateHelper.getDaysAgo(daysToKeep)
  const archiveDir = path.join(projectGlobalPath, layer, 'archive')
  await fileHelper.ensureDir(archiveDir)

  const sessionsDir = path.join(projectGlobalPath, layer, 'sessions')

  // Find all session files older than cutoff
  const archived: string[] = []
  const errors: Array<{ filename: string; error: string }> = []

  try {
    const years = await fileHelper.listFiles(sessionsDir, { dirsOnly: true })

    for (const year of years) {
      const yearPath = path.join(sessionsDir, year)
      const months = await fileHelper.listFiles(yearPath, { dirsOnly: true })

      for (const month of months) {
        const monthPath = path.join(yearPath, month)
        const sessionFiles = await fileHelper.listFiles(monthPath, { filesOnly: true })

        for (const filename of sessionFiles) {
          // Parse date from filename (YYYY-MM-DD.jsonl)
          const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/)
          if (!dateMatch) continue

          const sessionDate = new Date(dateMatch[1])
          if (sessionDate < cutoffDate) {
            const sourcePath = path.join(monthPath, filename)
            const destPath = path.join(archiveDir, filename)

            try {
              await fileHelper.moveFile(sourcePath, destPath)
              archived.push(filename)
            } catch (error) {
              errors.push({ filename, error: getErrorMessage(error) })
            }
          }
        }
      }
    }
  } catch (_error) {
    // Sessions directory might not exist yet - expected
  }

  return {
    archived: archived.length,
    files: archived,
    errors,
  }
}

/**
 * Clean empty session directories
 */
export async function cleanEmptySessionDirs(
  projectGlobalPath: string,
  layer: string
): Promise<number> {
  const sessionsDir = path.join(projectGlobalPath, layer, 'sessions')
  let cleaned = 0

  try {
    const years = await fileHelper.listFiles(sessionsDir, { dirsOnly: true })

    for (const year of years) {
      const yearPath = path.join(sessionsDir, year)
      const months = await fileHelper.listFiles(yearPath, { dirsOnly: true })

      for (const month of months) {
        const monthPath = path.join(yearPath, month)
        const files = await fileHelper.listFiles(monthPath)

        if (files.length === 0) {
          await fileHelper.deleteDir(monthPath)
          cleaned++
        }
      }

      // Check if year directory is now empty
      const remainingMonths = await fileHelper.listFiles(yearPath, { dirsOnly: true })
      if (remainingMonths.length === 0) {
        await fileHelper.deleteDir(yearPath)
        cleaned++
      }
    }
  } catch (_error) {
    // Sessions directory might not exist - expected
  }

  return cleaned
}
