import fs from 'fs/promises'
import fsSync from 'fs'
import readline from 'readline'
import path from 'path'
import { isNotFoundError } from '../types/fs'

/**
 * JSONL Helper - Centralized JSONL parsing and writing
 *
 * Eliminates duplicated JSONL logic across:
 * - session-manager.ts (_parseJsonLines)
 * - commands.ts (inline parsing)
 * - analyzer.ts (inline parsing)
 *
 * JSONL Format: One JSON object per line, newline-separated
 * Example:
 * {"ts":"2025-10-04T14:30:00Z","type":"feature_add","name":"auth"}
 * {"ts":"2025-10-04T15:00:00Z","type":"task_start","task":"JWT"}
 */

interface FileSizeWarning {
  sizeMB: number
  isLarge: boolean
}

/**
 * Parse JSONL content into array of objects
 * Handles malformed lines gracefully (skips them)
 */
export function parseJsonLines<T = Record<string, unknown>>(content: string): T[] {
  const lines = content.split('\n').filter((line) => line.trim())
  const entries: T[] = []

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as T)
    } catch {
      // Skip malformed lines silently
    }
  }

  return entries
}

/**
 * Convert array of objects to JSONL string
 */
export function stringifyJsonLines(objects: unknown[]): string {
  return objects.map((obj) => JSON.stringify(obj)).join('\n') + '\n'
}

/**
 * Read and parse JSONL file
 */
export async function readJsonLines<T = Record<string, unknown>>(filePath: string): Promise<T[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return parseJsonLines<T>(content)
  } catch (error) {
    if (isNotFoundError(error)) {
      return [] // File doesn't exist, return empty array
    }
    throw error
  }
}

/**
 * Write array of objects to JSONL file (overwrites)
 */
export async function writeJsonLines(filePath: string, objects: unknown[]): Promise<void> {
  const content = stringifyJsonLines(objects)
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Append a single object to JSONL file
 * Uses append mode for efficiency (no full file read/write)
 */
export async function appendJsonLine(filePath: string, object: unknown): Promise<void> {
  const line = JSON.stringify(object) + '\n'
  await fs.appendFile(filePath, line, 'utf-8')
}

/**
 * Append multiple objects to JSONL file
 */
export async function appendJsonLines(filePath: string, objects: unknown[]): Promise<void> {
  const content = stringifyJsonLines(objects)
  await fs.appendFile(filePath, content, 'utf-8')
}

/**
 * Filter JSONL file entries by predicate
 * Reads all entries, filters, returns matching ones
 */
export async function filterJsonLines<T = Record<string, unknown>>(
  filePath: string,
  predicate: (entry: T) => boolean
): Promise<T[]> {
  const entries = await readJsonLines<T>(filePath)
  return entries.filter(predicate)
}

/**
 * Count lines in JSONL file (non-empty, parseable lines)
 */
export async function countJsonLines(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim())
    return lines.length
  } catch (error) {
    if (isNotFoundError(error)) {
      return 0
    }
    throw error
  }
}

/**
 * Get last N entries from JSONL file
 * Efficient for large files (reads whole file but only returns last N)
 */
export async function getLastJsonLines<T = Record<string, unknown>>(
  filePath: string,
  n: number
): Promise<T[]> {
  const entries = await readJsonLines<T>(filePath)
  return entries.slice(-n)
}

/**
 * Get first N entries from JSONL file
 */
export async function getFirstJsonLines<T = Record<string, unknown>>(
  filePath: string,
  n: number
): Promise<T[]> {
  const entries = await readJsonLines<T>(filePath)
  return entries.slice(0, n)
}

/**
 * Merge multiple JSONL files into one array
 * Useful for reading multiple sessions
 */
export async function mergeJsonLines<T = Record<string, unknown>>(filePaths: string[]): Promise<T[]> {
  const allEntries: T[] = []

  for (const filePath of filePaths) {
    const entries = await readJsonLines<T>(filePath)
    allEntries.push(...entries)
  }

  return allEntries
}

/**
 * Check if JSONL file is empty or doesn't exist
 */
export async function isJsonLinesEmpty(filePath: string): Promise<boolean> {
  const count = await countJsonLines(filePath)
  return count === 0
}

/**
 * Read JSONL file with streaming (memory-efficient for large files)
 * Only reads last N lines instead of loading entire file
 */
export async function readJsonLinesStreaming<T = Record<string, unknown>>(
  filePath: string,
  maxLines = 1000
): Promise<T[]> {
  try {
    const fileStream = fsSync.createReadStream(filePath)
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })

    const lines: T[] = []

    for await (const line of rl) {
      if (line.trim()) {
        try {
          lines.push(JSON.parse(line) as T)
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
    if (isNotFoundError(error)) {
      return []
    }
    throw error
  }
}

/**
 * Get file size in MB
 */
export async function getFileSizeMB(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath)
    return stats.size / (1024 * 1024)
  } catch (error) {
    if (isNotFoundError(error)) {
      return 0
    }
    throw error
  }
}

/**
 * Rotate JSONL file if it exceeds size limit
 * Moves large file to archive with timestamp
 */
export async function rotateJsonLinesIfNeeded(filePath: string, maxSizeMB = 10): Promise<boolean> {
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
 */
export async function appendJsonLineWithRotation(
  filePath: string,
  object: unknown,
  maxSizeMB = 10
): Promise<void> {
  // Rotate if needed (before appending)
  await rotateJsonLinesIfNeeded(filePath, maxSizeMB)

  // Append normally
  await appendJsonLine(filePath, object)
}

/**
 * Warn if file is large before reading
 * Returns size and whether it's considered large
 */
export async function checkFileSizeWarning(
  filePath: string,
  warnThresholdMB = 50
): Promise<FileSizeWarning> {
  const sizeMB = await getFileSizeMB(filePath)
  const isLarge = sizeMB > warnThresholdMB

  if (isLarge) {
    console.warn(
      `⚠️  Large file detected: ${path.basename(filePath)} (${sizeMB.toFixed(1)}MB). Reading may use significant memory.`
    )
  }

  return { sizeMB, isLarge }
}

// Default export for CommonJS compatibility
export default {
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
  readJsonLinesStreaming,
  getFileSizeMB,
  rotateJsonLinesIfNeeded,
  appendJsonLineWithRotation,
  checkFileSizeWarning
}

