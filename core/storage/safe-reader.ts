/**
 * Safe Reader
 *
 * Wraps JSON.parse + Zod schema.safeParse() for validated storage reads.
 * On corruption: logs warning, creates .backup, returns null.
 *
 * Uses schema for structural validation only — returns the raw parsed
 * data (not Zod-transformed) to preserve extra fields that may exist
 * in storage files but aren't in the schema yet (forward compatibility).
 *
 * @version 1.0.0
 */

import fs from 'node:fs/promises'
import type { ZodError } from 'zod'
import { isNotFoundError } from '../types/fs'
import type { ValidationSchema } from '../types/storage.js'

/**
 * Read and validate a JSON file against a Zod schema.
 *
 * Flow:
 * 1. Read file → if missing, return null
 * 2. JSON.parse → if malformed JSON, backup + return null
 * 3. schema.safeParse → if valid, return raw parsed data as T
 * 4. If invalid but parseable JSON, backup + return null
 *
 * Returns raw parsed JSON (not Zod-transformed) to preserve extra fields.
 *
 * @returns Validated data or null if file is missing/corrupted
 */
export async function safeRead<T>(filePath: string, schema: ValidationSchema): Promise<T | null> {
  let content: string

  // Step 1: Read file
  try {
    content = await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }
    throw error
  }

  // Step 2: JSON.parse
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    // Malformed JSON — backup and return null
    await createBackup(filePath, content)
    logCorruption(filePath, 'Malformed JSON')
    return null
  }

  // Step 3: Validate against schema
  const result = schema.safeParse(raw)
  if (result.success) {
    // Return raw data to preserve extra fields not in schema
    return raw as T
  }

  // Step 4: Validation failed — backup and return null
  await createBackup(filePath, content)
  logCorruption(filePath, formatZodError(result.error!))
  return null
}

/**
 * Create a .backup of a corrupted file
 */
async function createBackup(filePath: string, content: string): Promise<void> {
  const backupPath = `${filePath}.backup`
  try {
    await fs.writeFile(backupPath, content, 'utf-8')
  } catch {
    // Best-effort backup — don't throw if it fails
  }
}

/**
 * Log corruption warning to stderr
 */
function logCorruption(filePath: string, reason: string): void {
  console.error(`[prjct] Warning: Corrupted storage file: ${filePath}`)
  console.error(`[prjct]   Reason: ${reason}`)
  console.error(`[prjct]   A .backup file has been created. Returning defaults.`)
}

/**
 * Format Zod error into a readable string
 */
function formatZodError(error: ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ')
}
