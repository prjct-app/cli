/**
 * Session Migration
 * Migrate legacy single-file logs to session structure
 */

import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import type { SessionEntry, SessionLogMetadata, SessionMigrationResult } from '../types'
import * as dateHelper from '../utils/date-helper'
import * as fileHelper from '../utils/file-helper'
import * as jsonlHelper from '../utils/jsonl-helper'

/**
 * Migrate legacy JSONL file
 */
export async function migrateLegacyJsonl(
  projectId: string,
  content: string,
  sessionFilename: string,
  updateMetadata: (sessionPath: string, updates: Partial<SessionLogMetadata>) => Promise<void>,
  ensureMetadata: (sessionPath: string) => Promise<void>
): Promise<SessionMigrationResult> {
  const entries = jsonlHelper.parseJsonLines(content) as SessionEntry[]
  const sessionGroups = new Map<string, SessionEntry[]>()

  for (const entry of entries) {
    const date = new Date(entry.timestamp || entry.data?.timestamp || Date.now())
    const dateKey = dateHelper.getDateKey(date)

    if (!sessionGroups.has(dateKey)) {
      sessionGroups.set(dateKey, [])
    }
    sessionGroups.get(dateKey)!.push(entry)
  }

  let migratedCount = 0
  for (const [dateKey, groupEntries] of sessionGroups) {
    const [year, monthStr, day] = dateKey.split('-')
    const month = parseInt(monthStr, 10)
    const date = new Date(parseInt(year, 10), month - 1, parseInt(day, 10))
    const sessionPath = await pathManager.ensureSessionPath(projectId, date)
    const filePath = path.join(sessionPath, sessionFilename)

    await jsonlHelper.writeJsonLines(filePath, groupEntries)

    migratedCount += groupEntries.length

    await ensureMetadata(sessionPath)
    await updateMetadata(sessionPath, {
      entryCount: groupEntries.length,
      migrated: true,
      migratedAt: dateHelper.getTimestamp(),
    })
  }

  return {
    success: true,
    message: `Migrated ${migratedCount} entries to ${sessionGroups.size} sessions`,
    entriesMigrated: migratedCount,
    sessionsCreated: sessionGroups.size,
  }
}

/**
 * Migrate legacy markdown file
 */
export async function migrateLegacyMarkdown(
  sessionPath: string,
  content: string,
  sessionFilename: string,
  updateMetadata: (sessionPath: string, updates: Partial<SessionLogMetadata>) => Promise<void>
): Promise<SessionMigrationResult> {
  const filePath = path.join(sessionPath, sessionFilename)

  await fileHelper.writeFile(filePath, content)

  await updateMetadata(sessionPath, {
    migrated: true,
    migratedAt: dateHelper.getTimestamp(),
  })

  return {
    success: true,
    message: 'Migrated markdown content to current session',
    entriesMigrated: 1,
    sessionsCreated: 1,
  }
}
