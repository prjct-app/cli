const fs = require('fs').promises
const fsSync = require('fs')
const readline = require('readline')
const path = require('path')

/**
 * JSONL Helper - Centralized JSONL parsing and writing
 *
 * Eliminates duplicated JSONL logic across:
 * - session-manager.js (_parseJsonLines)
 * - commands.js (inline parsing)
 * - analyzer.js (inline parsing)
 *
 * JSONL Format: One JSON object per line, newline-separated
 * Example:
 * {"ts":"2025-10-04T14:30:00Z","type":"feature_add","name":"auth"}
 * {"ts":"2025-10-04T15:00:00Z","type":"task_start","task":"JWT"}
 *
 * @module jsonl-helper
 */

/**
 * Parse JSONL content into array of objects
 * Handles malformed lines gracefully (skips them)
 *
 * @param {string} content - JSONL content
 * @returns {Array<Object>} - Array of parsed objects
 */
function parseJsonLines(content) {
  const lines = content.split('\n').filter((line) => line.trim())
  const entries = []

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line))
    } catch (error) {
      // Skip malformed lines silently
      // Could optionally log warning
    }
  }

  return entries
}

/**
 * Convert array of objects to JSONL string
 *
 * @param {Array<Object>} objects - Array of objects to stringify
 * @returns {string} - JSONL formatted string
 */
function stringifyJsonLines(objects) {
  return objects.map((obj) => JSON.stringify(obj)).join('\n') + '\n'
}

/**
 * Read and parse JSONL file
 *
 * @param {string} filePath - Path to JSONL file
 * @returns {Promise<Array<Object>>} - Array of parsed objects
 */
async function readJsonLines(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return parseJsonLines(content)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [] // File doesn't exist, return empty array
    }
    throw error
  }
}

/**
 * Write array of objects to JSONL file (overwrites)
 *
 * @param {string} filePath - Path to JSONL file
 * @param {Array<Object>} objects - Array of objects to write
 * @returns {Promise<void>}
 */
async function writeJsonLines(filePath, objects) {
  const content = stringifyJsonLines(objects)
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Append a single object to JSONL file
 * Uses append mode for efficiency (no full file read/write)
 *
 * @param {string} filePath - Path to JSONL file
 * @param {Object} object - Object to append
 * @returns {Promise<void>}
 */
async function appendJsonLine(filePath, object) {
  const line = JSON.stringify(object) + '\n'
  await fs.appendFile(filePath, line, 'utf-8')
}

/**
 * Append multiple objects to JSONL file
 *
 * @param {string} filePath - Path to JSONL file
 * @param {Array<Object>} objects - Objects to append
 * @returns {Promise<void>}
 */
async function appendJsonLines(filePath, objects) {
  const content = stringifyJsonLines(objects)
  await fs.appendFile(filePath, content, 'utf-8')
}

/**
 * Filter JSONL file entries by predicate
 * Reads all entries, filters, returns matching ones
 *
 * @param {string} filePath - Path to JSONL file
 * @param {Function} predicate - Filter function (entry => boolean)
 * @returns {Promise<Array<Object>>} - Filtered entries
 */
async function filterJsonLines(filePath, predicate) {
  const entries = await readJsonLines(filePath)
  return entries.filter(predicate)
}

/**
 * Count lines in JSONL file (non-empty, parseable lines)
 *
 * @param {string} filePath - Path to JSONL file
 * @returns {Promise<number>} - Number of valid lines
 */
async function countJsonLines(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim())
    return lines.length
  } catch (error) {
    if (error.code === 'ENOENT') {
      return 0
    }
    throw error
  }
}

/**
 * Get last N entries from JSONL file
 * Efficient for large files (reads whole file but only returns last N)
 *
 * @param {string} filePath - Path to JSONL file
 * @param {number} n - Number of entries to return
 * @returns {Promise<Array<Object>>} - Last N entries
 */
async function getLastJsonLines(filePath, n) {
  const entries = await readJsonLines(filePath)
  return entries.slice(-n)
}

/**
 * Get first N entries from JSONL file
 *
 * @param {string} filePath - Path to JSONL file
 * @param {number} n - Number of entries to return
 * @returns {Promise<Array<Object>>} - First N entries
 */
async function getFirstJsonLines(filePath, n) {
  const entries = await readJsonLines(filePath)
  return entries.slice(0, n)
}

/**
 * Merge multiple JSONL files into one array
 * Useful for reading multiple sessions
 *
 * @param {Array<string>} filePaths - Array of JSONL file paths
 * @returns {Promise<Array<Object>>} - Merged entries from all files
 */
async function mergeJsonLines(filePaths) {
  const allEntries = []

  for (const filePath of filePaths) {
    const entries = await readJsonLines(filePath)
    allEntries.push(...entries)
  }

  return allEntries
}

/**
 * Check if JSONL file is empty or doesn't exist
 *
 * @param {string} filePath - Path to JSONL file
 * @returns {Promise<boolean>} - True if empty or non-existent
 */
async function isJsonLinesEmpty(filePath) {
  const count = await countJsonLines(filePath)
  return count === 0
}

/**
 * Read JSONL file with streaming (memory-efficient for large files)
 * Only reads last N lines instead of loading entire file
 *
 * @param {string} filePath - Path to JSONL file
 * @param {number} maxLines - Maximum lines to read (default: 1000)
 * @returns {Promise<Array<Object>>} - Array of parsed objects (last N lines)
 */
async function readJsonLinesStreaming(filePath, maxLines = 1000) {
  try {
    const fileStream = fsSync.createReadStream(filePath)
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })

    const lines = []

    for await (const line of rl) {
      if (line.trim()) {
        try {
          lines.push(JSON.parse(line))
        } catch {
          // Skip malformed lines
        }

        // Keep only last maxLines
        if (lines.length > maxLines) {
          lines.shift()
        }
      }
    }

    return lines
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

/**
 * Get file size in MB
 *
 * @param {string} filePath - Path to file
 * @returns {Promise<number>} - File size in MB
 */
async function getFileSizeMB(filePath) {
  try {
    const stats = await fs.stat(filePath)
    return stats.size / (1024 * 1024)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return 0
    }
    throw error
  }
}

/**
 * Rotate JSONL file if it exceeds size limit
 * Moves large file to archive with timestamp
 *
 * @param {string} filePath - Path to JSONL file
 * @param {number} maxSizeMB - Maximum size in MB before rotation (default: 10)
 * @returns {Promise<boolean>} - True if rotated, false if not needed
 */
async function rotateJsonLinesIfNeeded(filePath, maxSizeMB = 10) {
  const sizeMB = await getFileSizeMB(filePath)

  if (sizeMB < maxSizeMB) {
    return false // No rotation needed
  }

  // Generate archive filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const dir = path.dirname(filePath)
  const ext = path.extname(filePath)
  const base = path.basename(filePath, ext)
  const archivePath = path.join(dir, `${base}-${timestamp}${ext}`)

  // Move file to archive
  await fs.rename(filePath, archivePath)

  console.log(`📦 Rotated ${path.basename(filePath)} (${sizeMB.toFixed(1)}MB) → ${path.basename(archivePath)}`)

  return true
}

/**
 * Append JSON line with automatic rotation
 * Checks file size before append and rotates if needed
 *
 * @param {string} filePath - Path to JSONL file
 * @param {Object} object - Object to append
 * @param {number} maxSizeMB - Maximum size before rotation (default: 10)
 * @returns {Promise<void>}
 */
async function appendJsonLineWithRotation(filePath, object, maxSizeMB = 10) {
  // Rotate if needed (before appending)
  await rotateJsonLinesIfNeeded(filePath, maxSizeMB)

  // Append normally
  await appendJsonLine(filePath, object)
}

/**
 * Warn if file is large before reading
 * Returns size and whether it's considered large
 *
 * @param {string} filePath - Path to file
 * @param {number} warnThresholdMB - Threshold in MB to warn (default: 50)
 * @returns {Promise<{sizeMB: number, isLarge: boolean}>}
 */
async function checkFileSizeWarning(filePath, warnThresholdMB = 50) {
  const sizeMB = await getFileSizeMB(filePath)
  const isLarge = sizeMB > warnThresholdMB

  if (isLarge) {
    console.warn(
      `⚠️  Large file detected: ${path.basename(filePath)} (${sizeMB.toFixed(1)}MB). Reading may use significant memory.`
    )
  }

  return { sizeMB, isLarge }
}

module.exports = {
  parseJsonLines,
  stringifyJsonLines,
  readJsonLines,
  writeJsonLines,
  appendJsonLine,
  appendJsonLines,
  filterJsonLines,
  countJsonLines,
  getLastJsonLines,
  getFirstJsonLines,
  mergeJsonLines,
  isJsonLinesEmpty,
  // NEW: Memory-efficient functions
  readJsonLinesStreaming,
  getFileSizeMB,
  rotateJsonLinesIfNeeded,
  appendJsonLineWithRotation,
  checkFileSizeWarning,
}
