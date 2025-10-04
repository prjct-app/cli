const fs = require('fs').promises

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
}
