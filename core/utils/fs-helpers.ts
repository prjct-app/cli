import fs from 'node:fs/promises'

/**
 * Async check if a file/directory exists
 * Replacement for fs.existsSync
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
