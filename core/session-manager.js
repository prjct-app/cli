const fs = require('fs').promises
const path = require('path')
const pathManager = require('./path-manager')
const { VERSION } = require('./version')

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

    const logLine = JSON.stringify(entry) + '\n'

    try {
      const existing = await fs.readFile(filePath, 'utf-8')
      await fs.writeFile(filePath, existing + logLine, 'utf-8')
    } catch {
      await fs.writeFile(filePath, logLine, 'utf-8')
    }

    await this._updateSessionMetadata(sessionPath, {
      lastActivity: new Date().toISOString(),
      entryCount: await this._getFileLineCount(filePath),
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

    try {
      const existing = await fs.readFile(filePath, 'utf-8')
      await fs.writeFile(filePath, existing + content, 'utf-8')
    } catch {
      let initialContent = ''
      if (filename === 'shipped.md') {
        initialContent = '# SHIPPED 🚀\n\n'
      }
      await fs.writeFile(filePath, initialContent + content, 'utf-8')
    }

    await this._updateSessionMetadata(sessionPath, {
      lastActivity: new Date().toISOString(),
    })
  }

  /**
   * Read logs from current session
   *
   * @param {string} projectId - The project identifier
   * @param {string} filename - Source filename (default: context.jsonl)
   * @returns {Promise<Array<Object>>} - Array of parsed log entries
   */
  async readCurrentSession(projectId, filename = 'context.jsonl') {
    const sessionPath = await this.getCurrentSession(projectId)
    const filePath = path.join(sessionPath, filename)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return this._parseJsonLines(content)
    } catch {
      return []
    }
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
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const entries = this._parseJsonLines(content)

        entries.forEach(entry => {
          entry._sessionDate = session.date
        })

        allEntries.push(...entries)
      } catch {
        continue
      }
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
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        if (content.trim()) {
          allContent.push(`## Session: ${session.year}-${session.month}-${session.day}\n\n${content}`)
        }
      } catch {
        continue
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
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)

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
      const content = await fs.readFile(legacyFilePath, 'utf-8')

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
    const entries = this._parseJsonLines(content)
    const sessionGroups = new Map()

    for (const entry of entries) {
      const date = new Date(entry.timestamp || entry.data?.timestamp || Date.now())
      const dateKey = this._getDateKey(date)

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

      const content = groupEntries.map(e => JSON.stringify(e)).join('\n') + '\n'
      await fs.writeFile(filePath, content, 'utf-8')

      migratedCount += groupEntries.length

      await this._ensureSessionMetadata(sessionPath)
      await this._updateSessionMetadata(sessionPath, {
        entryCount: groupEntries.length,
        migrated: true,
        migratedAt: new Date().toISOString(),
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

    await fs.writeFile(filePath, content, 'utf-8')

    await this._updateSessionMetadata(sessionPath, {
      migrated: true,
      migratedAt: new Date().toISOString(),
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

    try {
      const content = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(content)
      this.sessionMetadataCache.set(sessionPath, metadata)
      return metadata
    } catch {
      return null
    }
  }

  /**
   * Ensure session metadata exists
   * @private
   */
  async _ensureSessionMetadata(sessionPath) {
    const metadataPath = path.join(sessionPath, 'session-meta.json')

    try {
      await fs.access(metadataPath)
    } catch {
      // Create initial metadata
      const metadata = {
        created: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        entryCount: 0,
        shipCount: 0,
        version: VERSION,
      }
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
      this.sessionMetadataCache.set(sessionPath, metadata)
    }
  }

  /**
   * Update session metadata
   * @private
   */
  async _updateSessionMetadata(sessionPath, updates) {
    const metadata = await this._getSessionMetadata(sessionPath) || {}
    Object.assign(metadata, updates)

    const metadataPath = path.join(sessionPath, 'session-meta.json')
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')

    this.sessionMetadataCache.set(sessionPath, metadata)
  }

  /**
   * Parse JSONL content
   * @private
   */
  _parseJsonLines(content) {
    const lines = content.split('\n').filter(line => line.trim())
    const entries = []

    for (const line of lines) {
      try {
        entries.push(JSON.parse(line))
      } catch {
      }
    }

    return entries
  }

  /**
   * Get line count from file
   * @private
   */
  async _getFileLineCount(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content.split('\n').filter(line => line.trim()).length
    } catch {
      return 0
    }
  }

  /**
   * Get today's date key (YYYY-MM-DD)
   * @private
   */
  _getTodayKey() {
    return this._getDateKey(new Date())
  }

  /**
   * Get date key for any date (YYYY-MM-DD)
   * @private
   */
  _getDateKey(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  clearCache() {
    this.currentSessionCache.clear()
    this.sessionMetadataCache.clear()
  }
}

module.exports = new SessionManager()
