const path = require('path')
const pathManager = require('./path-manager')
const { VERSION } = require('../utils/version')
const dateHelper = require('../utils/date-helper')
const jsonlHelper = require('../utils/jsonl-helper')
const fileHelper = require('../utils/file-helper')

/**
 * SessionManager - Manages temporal fragmentation of logs and progress data
 *
 * Handles:
 * - Daily session creation and rotation
 * - Writing logs to date-specific directories
 * - Reading historical data across multiple sessions
 * - Session consolidation and queries
 * - Automatic migration from legacy single-file logs
 *
 * @version 0.2.1
 */
class SessionManager {
  constructor() {
    this.currentSessionCache = new Map() // Cache current session paths
    this.sessionMetadataCache = new Map() // Cache session metadata
  }

  /**
   * Get or create current session directory for a project
   *
   * @param {string} projectId - The project identifier
   * @returns {Promise<string>} - Path to today's session directory
   */
  async getCurrentSession(projectId) {
    const cacheKey = `${projectId}-${this._getTodayKey()}`

    if (this.currentSessionCache.has(cacheKey)) {
      return this.currentSessionCache.get(cacheKey)
    }

    const sessionPath = await pathManager.ensureSessionPath(projectId)
    this.currentSessionCache.set(cacheKey, sessionPath)

    await this._ensureSessionMetadata(sessionPath)

    return sessionPath
  }

  /**
   * Write log entry to current session
   *
   * @param {string} projectId - The project identifier
   * @param {Object} entry - Log entry object
   * @param {string} filename - Target filename (default: context.jsonl)
   * @returns {Promise<void>}
   */
  async writeToSession(projectId, entry, filename = 'context.jsonl') {
    const sessionPath = await this.getCurrentSession(projectId)
    const filePath = path.join(sessionPath, filename)

    // Use automatic rotation to prevent large files (>10MB)
    await jsonlHelper.appendJsonLineWithRotation(filePath, entry, 10)

    await this._updateSessionMetadata(sessionPath, {
      lastActivity: dateHelper.getTimestamp(),
      entryCount: await jsonlHelper.countJsonLines(filePath),
    })
  }

  /**
   * Append content to a session file (for markdown files like shipped.md)
   *
   * @param {string} projectId - The project identifier
   * @param {string} content - Content to append
   * @param {string} filename - Target filename
   * @returns {Promise<void>}
   */
  async appendToSession(projectId, content, filename) {
    const sessionPath = await this.getCurrentSession(projectId)
    const filePath = path.join(sessionPath, filename)

    const exists = await fileHelper.fileExists(filePath)
    if (!exists && filename === 'shipped.md') {
      await fileHelper.writeFile(filePath, '# SHIPPED 🚀\n\n' + content)
    } else {
      await fileHelper.appendToFile(filePath, content)
    }

    await this._updateSessionMetadata(sessionPath, {
      lastActivity: dateHelper.getTimestamp(),
    })
  }

  /**
   * Read logs from current session
   * Uses streaming for large files (>50MB)
   *
   * @param {string} projectId - The project identifier
   * @param {string} filename - Source filename (default: context.jsonl)
   * @param {number} maxLines - Max lines to read for large files (default: 1000)
   * @returns {Promise<Array<Object>>} - Array of parsed log entries
   */
  async readCurrentSession(projectId, filename = 'context.jsonl', maxLines = 1000) {
    const sessionPath = await this.getCurrentSession(projectId)
    const filePath = path.join(sessionPath, filename)

    // Check file size and warn if large
    const { isLarge } = await jsonlHelper.checkFileSizeWarning(filePath, 50)

    if (isLarge) {
      // Use streaming for large files
      return await jsonlHelper.readJsonLinesStreaming(filePath, maxLines)
    }

    // Use normal read for small files
    return await jsonlHelper.readJsonLines(filePath)
  }

  /**
   * Read logs from a specific date range
   *
   * @param {string} projectId - The project identifier
   * @param {Date} fromDate - Start date
   * @param {Date} toDate - End date (defaults to today)
   * @param {string} filename - Source filename (default: context.jsonl)
   * @returns {Promise<Array<Object>>} - Array of parsed log entries from all sessions in range
   */
  async readSessionRange(projectId, fromDate, toDate = new Date(), filename = 'context.jsonl') {
    const sessions = await pathManager.getSessionsInRange(projectId, fromDate, toDate)
    const allEntries = []

    for (const session of sessions) {
      const filePath = path.join(session.path, filename)
      const entries = await jsonlHelper.readJsonLines(filePath)

      entries.forEach((entry) => {
        entry._sessionDate = session.date
      })

      allEntries.push(...entries)
    }

    return allEntries
  }

  /**
   * Read markdown content from sessions in date range
   *
   * @param {string} projectId - The project identifier
   * @param {Date} fromDate - Start date
   * @param {Date} toDate - End date
   * @param {string} filename - Source filename (e.g., 'shipped.md')
   * @returns {Promise<string>} - Concatenated content from all sessions
   */
  async readMarkdownRange(projectId, fromDate, toDate, filename) {
    const sessions = await pathManager.getSessionsInRange(projectId, fromDate, toDate)
    const allContent = []

    for (const session of sessions) {
      const filePath = path.join(session.path, filename)
      const content = await fileHelper.readFile(filePath, '')

      if (content.trim()) {
        allContent.push(
          `## Session: ${session.year}-${session.month}-${session.day}\n\n${content}`
        )
      }
    }

    return allContent.join('\n---\n\n')
  }

  /**
   * Get recent logs (last N days)
   *
   * @param {string} projectId - The project identifier
   * @param {number} days - Number of days to look back
   * @param {string} filename - Source filename
   * @returns {Promise<Array<Object>>} - Recent log entries
   */
  async getRecentLogs(projectId, days = 7, filename = 'context.jsonl') {
    const toDate = new Date()
    const fromDate = dateHelper.getDaysAgo(days)

    return await this.readSessionRange(projectId, fromDate, toDate, filename)
  }

  /**
   * Get session statistics
   *
   * @param {string} projectId - The project identifier
   * @param {Date} fromDate - Start date
   * @param {Date} toDate - End date
   * @returns {Promise<Object>} - Statistics object
   */
  async getSessionStats(projectId, fromDate, toDate) {
    const sessions = await pathManager.getSessionsInRange(projectId, fromDate, toDate)

    let totalEntries = 0
    let totalShips = 0
    let activeDays = 0

    for (const session of sessions) {
      const metadata = await this._getSessionMetadata(session.path)
      if (metadata) {
        totalEntries += metadata.entryCount || 0
        totalShips += metadata.shipCount || 0
        if (metadata.entryCount > 0) {
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
   *
   * @param {string} projectId - The project identifier
   * @param {string} legacyFilePath - Path to legacy log file
   * @param {string} sessionFilename - Target filename in sessions
   * @returns {Promise<Object>} - Migration result
   */
  async migrateLegacyLogs(projectId, legacyFilePath, sessionFilename) {
    try {
      const content = await fileHelper.readFile(legacyFilePath)

      if (sessionFilename.endsWith('.jsonl')) {
        return await this._migrateLegacyJsonl(projectId, content, sessionFilename)
      } else {
        return await this._migrateLegacyMarkdown(projectId, content, sessionFilename)
      }
    } catch (error) {
      return {
        success: false,
        message: `Migration failed: ${error.message}`,
        entriesMigrated: 0,
      }
    }
  }

  /**
   * Migrate legacy JSONL file
   * @private
   */
  async _migrateLegacyJsonl(projectId, content, sessionFilename) {
    const entries = jsonlHelper.parseJsonLines(content)
    const sessionGroups = new Map()

    for (const entry of entries) {
      const date = new Date(entry.timestamp || entry.data?.timestamp || Date.now())
      const dateKey = dateHelper.getDateKey(date)

      if (!sessionGroups.has(dateKey)) {
        sessionGroups.set(dateKey, [])
      }
      sessionGroups.get(dateKey).push(entry)
    }

    let migratedCount = 0
    for (const [dateKey, groupEntries] of sessionGroups) {
      const [year, month, day] = dateKey.split('-')
      const date = new Date(year, month - 1, day)
      const sessionPath = await pathManager.ensureSessionPath(projectId, date)
      const filePath = path.join(sessionPath, sessionFilename)

      await jsonlHelper.writeJsonLines(filePath, groupEntries)

      migratedCount += groupEntries.length

      await this._ensureSessionMetadata(sessionPath)
      await this._updateSessionMetadata(sessionPath, {
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
   * @private
   */
  async _migrateLegacyMarkdown(projectId, content, sessionFilename) {
    const sessionPath = await this.getCurrentSession(projectId)
    const filePath = path.join(sessionPath, sessionFilename)

    await fileHelper.writeFile(filePath, content)

    await this._updateSessionMetadata(sessionPath, {
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

  /**
   * Get session metadata
   * @private
   */
  async _getSessionMetadata(sessionPath) {
    const metadataPath = path.join(sessionPath, 'session-meta.json')

    if (this.sessionMetadataCache.has(sessionPath)) {
      return this.sessionMetadataCache.get(sessionPath)
    }

    const metadata = await fileHelper.readJson(metadataPath, null)
    if (metadata) {
      this.sessionMetadataCache.set(sessionPath, metadata)
    }
    return metadata
  }

  /**
   * Ensure session metadata exists
   * @private
   */
  async _ensureSessionMetadata(sessionPath) {
    const metadataPath = path.join(sessionPath, 'session-meta.json')

    const exists = await fileHelper.fileExists(metadataPath)
    if (!exists) {
      const metadata = {
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
   * @private
   */
  async _updateSessionMetadata(sessionPath, updates) {
    const metadata = (await this._getSessionMetadata(sessionPath)) || {}
    Object.assign(metadata, updates)

    const metadataPath = path.join(sessionPath, 'session-meta.json')
    await fileHelper.writeJson(metadataPath, metadata)

    this.sessionMetadataCache.set(sessionPath, metadata)
  }

  /**
   * Get today's date key (YYYY-MM-DD)
   * @private
   */
  _getTodayKey() {
    return dateHelper.getTodayKey()
  }

  /**
   * Get date key for any date (YYYY-MM-DD)
   * @private
   */
  _getDateKey(date) {
    return dateHelper.getDateKey(date)
  }

  clearCache() {
    this.currentSessionCache.clear()
    this.sessionMetadataCache.clear()
  }
}

module.exports = new SessionManager()
