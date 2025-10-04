const path = require('path')
const dateHelper = require('./date-helper')
const jsonlHelper = require('./jsonl-helper')
const fileHelper = require('./file-helper')

/**
 * Session Helper - High-level session operations
 *
 * Simplifies common session workflows by combining:
 * - date-helper (date formatting)
 * - jsonl-helper (JSONL parsing)
 * - file-helper (file operations)
 * - path-manager (path construction)
 *
 * @module session-helper
 */

/**
 * Build session file path for today
 *
 * @param {string} projectGlobalPath - Global project path
 * @param {string} layer - Layer (planning/progress/memory)
 * @param {string} filename - Filename (e.g., '2025-10-04.jsonl')
 * @returns {string} - Full path to session file
 */
function getTodaySessionFilePath(projectGlobalPath, layer, filename = null) {
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
 *
 * @param {string} projectGlobalPath - Global project path
 * @param {string} layer - Layer (planning/progress/memory)
 * @returns {Promise<string>} - Path to session directory
 */
async function ensureTodaySessionDir(projectGlobalPath, layer) {
  const yearMonth = dateHelper.formatMonth(new Date())
  const [year, month] = yearMonth.split('-')

  const sessionDir = path.join(projectGlobalPath, layer, 'sessions', year, month)
  await fileHelper.ensureDir(sessionDir)

  return sessionDir
}

/**
 * Write log entry to today's session
 *
 * @param {string} projectGlobalPath - Global project path
 * @param {string} layer - Layer (planning/progress/memory)
 * @param {Object} entry - Log entry to write
 * @param {string} filename - Optional custom filename (defaults to YYYY-MM-DD.jsonl)
 * @returns {Promise<void>}
 */
async function writeToSession(projectGlobalPath, layer, entry, filename = null) {
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
 *
 * @param {string} projectGlobalPath - Global project path
 * @param {string} layer - Layer (planning/progress/memory)
 * @param {string} filename - Optional custom filename
 * @returns {Promise<Array<Object>>} - Array of log entries
 */
async function readTodaySession(projectGlobalPath, layer, filename = null) {
  const filePath = getTodaySessionFilePath(projectGlobalPath, layer, filename)
  return await jsonlHelper.readJsonLines(filePath)
}

/**
 * Read session logs for a date range
 *
 * @param {string} projectGlobalPath - Global project path
 * @param {string} layer - Layer (planning/progress/memory)
 * @param {number} daysBack - Number of days to look back
 * @returns {Promise<Array<Object>>} - Array of all log entries
 */
async function readRecentSessions(projectGlobalPath, layer, daysBack = 7) {
  const fromDate = dateHelper.getDaysAgo(daysBack)
  const toDate = new Date()

  const dates = dateHelper.getDateRange(fromDate, toDate)
  const allEntries = []

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

    const entries = await jsonlHelper.readJsonLines(filePath)
    allEntries.push(...entries)
  }

  return allEntries
}

/**
 * Get session statistics for a layer
 *
 * @param {string} projectGlobalPath - Global project path
 * @param {string} layer - Layer (planning/progress/memory)
 * @param {number} daysBack - Number of days to analyze
 * @returns {Promise<Object>} - Statistics object
 */
async function getSessionStats(projectGlobalPath, layer, daysBack = 30) {
  const entries = await readRecentSessions(projectGlobalPath, layer, daysBack)

  // Group by type
  const byType = {}
  for (const entry of entries) {
    const type = entry.type || 'unknown'
    byType[type] = (byType[type] || 0) + 1
  }

  // Group by date
  const byDate = {}
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
 *
 * @param {string} projectGlobalPath - Global project path
 * @param {string} layer - Layer (planning/progress/memory)
 * @param {number} daysToKeep - Keep sessions newer than this (default: 30)
 * @returns {Promise<Object>} - Archive result
 */
async function archiveOldSessions(projectGlobalPath, layer, daysToKeep = 30) {
  const cutoffDate = dateHelper.getDaysAgo(daysToKeep)
  const archiveDir = path.join(projectGlobalPath, layer, 'archive')
  await fileHelper.ensureDir(archiveDir)

  const sessionsDir = path.join(projectGlobalPath, layer, 'sessions')

  // Find all session files older than cutoff
  const archived = []
  const errors = []

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
              errors.push({ filename, error: error.message })
            }
          }
        }
      }
    }
  } catch (error) {
    // Sessions directory might not exist yet
  }

  return {
    archived: archived.length,
    files: archived,
    errors,
  }
}

/**
 * Clean empty session directories
 *
 * @param {string} projectGlobalPath - Global project path
 * @param {string} layer - Layer (planning/progress/memory)
 * @returns {Promise<number>} - Number of directories removed
 */
async function cleanEmptySessionDirs(projectGlobalPath, layer) {
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
  } catch (error) {
    // Sessions directory might not exist
  }

  return cleaned
}

module.exports = {
  getTodaySessionFilePath,
  ensureTodaySessionDir,
  writeToSession,
  readTodaySession,
  readRecentSessions,
  getSessionStats,
  archiveOldSessions,
  cleanEmptySessionDirs,
}
