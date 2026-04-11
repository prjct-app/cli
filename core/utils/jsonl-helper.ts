import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
import { isNotFoundError } from '../types/fs'
import { STORAGE_LIMITS } from './constants'

/**
 * JSONL Helper - Centralized JSONL parsing and writing
 *
 * JSONL Format: One JSON object per line, newline-separated
 */

interface FileSizeWarning {
  sizeMB: number
  isLarge: boolean
}

function parseJsonLines<T = Record<string, unknown>>(content: string): T[] {
  const lines = content.split('\n').filter((line) => line.trim())
  const entries: T[] = []

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as T)
    } catch (_error) {
      // Skip malformed lines silently
    }
  }

  return entries
}

export async function readJsonLines<T = Record<string, unknown>>(filePath: string): Promise<T[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return parseJsonLines<T>(content)
  } catch (error) {
    if (isNotFoundError(error)) {
      return []
    }
    throw error
  }
}

async function appendJsonLine(filePath: string, object: unknown): Promise<void> {
  const line = `${JSON.stringify(object)}\n`
  await fs.appendFile(filePath, line, 'utf-8')
}

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

export async function readJsonLinesStreaming<T = Record<string, unknown>>(
  filePath: string,
  maxLines: number = STORAGE_LIMITS.JSONL_MAX_LINES
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
        } catch (_error) {
          // Skip malformed lines
        }

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

async function getFileSizeMB(filePath: string): Promise<number> {
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

async function rotateJsonLinesIfNeeded(
  filePath: string,
  maxSizeMB: number = STORAGE_LIMITS.ROTATION_SIZE_MB
): Promise<boolean> {
  const sizeMB = await getFileSizeMB(filePath)

  if (sizeMB < maxSizeMB) {
    return false
  }

  const timestamp = new Date().toISOString().split('T')[0]
  const dir = path.dirname(filePath)
  const ext = path.extname(filePath)
  const base = path.basename(filePath, ext)
  const archivePath = path.join(dir, `${base}-${timestamp}${ext}`)

  await fs.rename(filePath, archivePath)

  console.log(
    `📦 Rotated ${path.basename(filePath)} (${sizeMB.toFixed(1)}MB) → ${path.basename(archivePath)}`
  )

  return true
}

export async function appendJsonLineWithRotation(
  filePath: string,
  object: unknown,
  maxSizeMB: number = STORAGE_LIMITS.ROTATION_SIZE_MB
): Promise<void> {
  await rotateJsonLinesIfNeeded(filePath, maxSizeMB)
  await appendJsonLine(filePath, object)
}

export async function checkFileSizeWarning(
  filePath: string,
  warnThresholdMB: number = STORAGE_LIMITS.LARGE_FILE_WARN_MB
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
