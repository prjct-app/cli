/**
 * SessionLogManager Class
 * Manages temporal fragmentation of logs and progress data.
 * Writes to sessions/YYYY-MM/DD/ structure with auto-rotation.
 */

import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import type {
  SessionEntry,
  SessionLogMetadata,
  SessionMigrationResult,
  SessionStats,
} from '../types'
import { getErrorMessage } from '../types/fs'
import { TTLCache } from '../utils/cache'
import * as dateHelper from '../utils/date-helper'
import * as fileHelper from '../utils/file-helper'
import * as jsonlHelper from '../utils/jsonl-helper'
import { VERSION } from '../utils/version'
import { migrateLegacyJsonl, migrateLegacyMarkdown } from './log-migration'

export class SessionLogManager {
  private currentSessionCache: TTLCache<string>
  private sessionMetadataCache: TTLCache<SessionLogMetadata>

  constructor() {
    this.currentSessionCache = new TTLCache<string>({ maxSize: 50, ttl: 3_600_000 })
    this.sessionMetadataCache = new TTLCache<SessionLogMetadata>({ maxSize: 50, ttl: 3_600_000 })
  }

  /**
   * Get or create current session directory for a project
   */
  async getCurrentSession(projectId: string): Promise<string> {
    const cacheKey = `${projectId}-${this._getTodayKey()}`

    const cached = this.currentSessionCache.get(cacheKey)
    if (cached !== null) {
      return cached
    }

    const sessionPath = await pathManager.ensureSessionPath(projectId)
    this.currentSessionCache.set(cacheKey, sessionPath)

    await this._ensureSessionLogMetadata(sessionPath)

    return sessionPath
  }

  /**
   * Write log entry to current session
   */
  async writeToSession(
    projectId: string,
    entry: SessionEntry,
    filename: string = 'context.jsonl'
  ): Promise<void> {
    const sessionPath = await this.getCurrentSession(projectId)
    const filePath = path.join(sessionPath, filename)

    // Use automatic rotation to prevent large files (>10MB)
    await jsonlHelper.appendJsonLineWithRotation(filePath, entry, 10)

    await this._updateSessionLogMetadata(sessionPath, {
      lastActivity: dateHelper.getTimestamp(),
      entryCount: await jsonlHelper.countJsonLines(filePath),
    })
  }

  /**
   * Append content to a session file (for markdown files like shipped.md)
   */
  async appendToSession(projectId: string, content: string, filename: string): Promise<void> {
    const sessionPath = await this.getCurrentSession(projectId)
    const filePath = path.join(sessionPath, filename)

    const exists = await fileHelper.fileExists(filePath)
    if (!exists && filename === 'shipped.md') {
      await fileHelper.writeFile(filePath, `# SHIPPED 🚀\n\n${content}`)
    } else {
      await fileHelper.appendToFile(filePath, content)
    }

    await this._updateSessionLogMetadata(sessionPath, {
      lastActivity: dateHelper.getTimestamp(),
    })
  }

  /**
   * Read logs from current session
   * Uses streaming for large files (>50MB)
   */
  async readCurrentSession<T = SessionEntry>(
    projectId: string,
    filename: string = 'context.jsonl',
    maxLines: number = 1000
  ): Promise<T[]> {
    const sessionPath = await this.getCurrentSession(projectId)
    const filePath = path.join(sessionPath, filename)

    // Check file size and warn if large
    const { isLarge } = await jsonlHelper.checkFileSizeWarning(filePath, 50)

    if (isLarge) {
      // Use streaming for large files
      return (await jsonlHelper.readJsonLinesStreaming(filePath, maxLines)) as T[]
    }

    // Use normal read for small files
    return (await jsonlHelper.readJsonLines(filePath)) as T[]
  }

  /**
   * Read logs from a specific date range
   */
  async readSessionRange<T = SessionEntry>(
    projectId: string,
    fromDate: Date,
    toDate: Date = new Date(),
    filename: string = 'context.jsonl'
  ): Promise<T[]> {
    const sessions = await pathManager.getSessionsInRange(projectId, fromDate, toDate)
    const allEntries: T[] = []

    for (const session of sessions) {
      const filePath = path.join(session.path, filename)
      const entries = (await jsonlHelper.readJsonLines(filePath)) as (T & { _sessionDate?: Date })[]

      entries.forEach((entry) => {
        entry._sessionDate = session.date
      })

      allEntries.push(...entries)
    }

    return allEntries
  }

  /**
   * Read markdown content from sessions in date range
   */
  async readMarkdownRange(
    projectId: string,
    fromDate: Date,
    toDate: Date,
    filename: string
  ): Promise<string> {
    const sessions = await pathManager.getSessionsInRange(projectId, fromDate, toDate)
    const allContent: string[] = []

    for (const session of sessions) {
      const filePath = path.join(session.path, filename)
      const content = await fileHelper.readFile(filePath, '')

      if (content.trim()) {
        allContent.push(`## Session: ${session.year}-${session.month}-${session.day}\n\n${content}`)
      }
    }

    return allContent.join('\n---\n\n')
  }

  /**
   * Get recent logs (last N days)
   */
  async getRecentLogs<T = SessionEntry>(
    projectId: string,
    days: number = 7,
    filename: string = 'context.jsonl'
  ): Promise<T[]> {
    const toDate = new Date()
    const fromDate = dateHelper.getDaysAgo(days)

    return await this.readSessionRange<T>(projectId, fromDate, toDate, filename)
  }

  /**
   * Get session statistics
   */
  async getSessionStats(projectId: string, fromDate: Date, toDate: Date): Promise<SessionStats> {
    const sessions = await pathManager.getSessionsInRange(projectId, fromDate, toDate)

    let totalEntries = 0
    let totalShips = 0
    let activeDays = 0

    for (const session of sessions) {
      const metadata = await this._getSessionLogMetadata(session.path)
      if (metadata) {
        totalEntries += metadata.entryCount || 0
        totalShips += metadata.shipCount || 0
        if (metadata.entryCount && metadata.entryCount > 0) {
          activeDays++
        }
      }
    }

    return {
      totalSessions: sessions.length,
      activeDays,
      totalEntries,
      totalShips,
      averageEntriesPerDay: activeDays > 0 ? Math.round(totalEntries / activeDays) : 0,
    }
  }

  /**
   * Migrate legacy single-file logs to session structure
   */
  async migrateLegacyLogs(
    projectId: string,
    legacyFilePath: string,
    sessionFilename: string
  ): Promise<SessionMigrationResult> {
    try {
      const content = await fileHelper.readFile(legacyFilePath)

      if (sessionFilename.endsWith('.jsonl')) {
        return await migrateLegacyJsonl(
          projectId,
          content,
          sessionFilename,
          (sp, u) => this._updateSessionLogMetadata(sp, u),
          (sp) => this._ensureSessionLogMetadata(sp)
        )
      } else {
        const sessionPath = await this.getCurrentSession(projectId)
        return await migrateLegacyMarkdown(sessionPath, content, sessionFilename, (sp, u) =>
          this._updateSessionLogMetadata(sp, u)
        )
      }
    } catch (error) {
      return {
        success: false,
        message: `Migration failed: ${getErrorMessage(error)}`,
        entriesMigrated: 0,
      }
    }
  }

  /**
   * Get session metadata
   */
  private async _getSessionLogMetadata(sessionPath: string): Promise<SessionLogMetadata | null> {
    const metadataPath = path.join(sessionPath, 'session-meta.json')

    const cached = this.sessionMetadataCache.get(sessionPath)
    if (cached !== null) {
      return cached
    }

    const metadata = await fileHelper.readJson<SessionLogMetadata>(metadataPath, null)
    if (metadata) {
      this.sessionMetadataCache.set(sessionPath, metadata)
    }
    return metadata
  }

  /**
   * Ensure session metadata exists
   */
  private async _ensureSessionLogMetadata(sessionPath: string): Promise<void> {
    const metadataPath = path.join(sessionPath, 'session-meta.json')

    const exists = await fileHelper.fileExists(metadataPath)
    if (!exists) {
      const metadata: SessionLogMetadata = {
        created: dateHelper.getTimestamp(),
        lastActivity: dateHelper.getTimestamp(),
        entryCount: 0,
        shipCount: 0,
        version: VERSION,
      }
      await fileHelper.writeJson(metadataPath, metadata)
      this.sessionMetadataCache.set(sessionPath, metadata)
    }
  }

  /**
   * Update session metadata
   */
  private async _updateSessionLogMetadata(
    sessionPath: string,
    updates: Partial<SessionLogMetadata>
  ): Promise<void> {
    const metadata = (await this._getSessionLogMetadata(sessionPath)) || {}
    Object.assign(metadata, updates)

    const metadataPath = path.join(sessionPath, 'session-meta.json')
    await fileHelper.writeJson(metadataPath, metadata)

    this.sessionMetadataCache.set(sessionPath, metadata)
  }

  /**
   * Get today's date key (YYYY-MM-DD)
   */
  private _getTodayKey(): string {
    return dateHelper.getTodayKey()
  }

  clearCache(): void {
    this.currentSessionCache.clear()
    this.sessionMetadataCache.clear()
  }
}
