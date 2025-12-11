import fs from 'fs/promises'
import path from 'path'

/**
 * File Helper - Centralized file operations with error handling
 *
 * Eliminates duplicated fs operations across:
 * - 101 fs.readFile/writeFile calls in 18 files
 * - Consistent error handling
 * - JSON read/write patterns
 */

interface ListFilesOptions {
  filesOnly?: boolean
  dirsOnly?: boolean
  extension?: string
}

interface NodeError extends Error {
  code?: string
}

/**
 * Read JSON file and parse
 */
export async function readJson<T = unknown>(filePath: string, defaultValue: T | null = null): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (error) {
    if ((error as NodeError).code === 'ENOENT') {
      return defaultValue
    }
    throw error
  }
}

/**
 * Write object to JSON file (pretty-printed)
 */
export async function writeJson(filePath: string, data: unknown, indent = 2): Promise<void> {
  const content = JSON.stringify(data, null, indent)
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Read text file
 */
export async function readFile(filePath: string, defaultValue = ''): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    if ((error as NodeError).code === 'ENOENT') {
      return defaultValue
    }
    throw error
  }
}

/**
 * Write text file
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Atomic write - writes to temp file then renames (prevents partial writes)
 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  const tempPath = `${filePath}.${Date.now()}.tmp`
  await fs.writeFile(tempPath, content, 'utf-8')
  await fs.rename(tempPath, filePath)
}

/**
 * Append to text file
 */
export async function appendToFile(filePath: string, content: string): Promise<void> {
  await fs.appendFile(filePath, content, 'utf-8')
}

/**
 * Prepend to text file (adds content at beginning)
 */
export async function prependToFile(filePath: string, content: string): Promise<void> {
  try {
    const existing = await fs.readFile(filePath, 'utf-8')
    await fs.writeFile(filePath, content + existing, 'utf-8')
  } catch (error) {
    if ((error as NodeError).code === 'ENOENT') {
      await fs.writeFile(filePath, content, 'utf-8')
    } else {
      throw error
    }
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Check if directory exists
 */
export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * Ensure directory exists (create if not)
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

/**
 * Delete file if it exists
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath)
    return true
  } catch (error) {
    if ((error as NodeError).code === 'ENOENT') {
      return false // File didn't exist
    }
    throw error
  }
}

/**
 * Delete directory and all contents
 */
export async function deleteDir(dirPath: string): Promise<boolean> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true })
    return true
  } catch (error) {
    if ((error as NodeError).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

/**
 * List files in directory
 */
export async function listFiles(dirPath: string, options: ListFilesOptions = {}): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    let files = entries

    if (options.filesOnly) {
      files = files.filter((entry) => entry.isFile())
    }

    if (options.dirsOnly) {
      files = files.filter((entry) => entry.isDirectory())
    }

    if (options.extension) {
      files = files.filter((entry) => entry.name.endsWith(options.extension!))
    }

    return files.map((entry) => entry.name)
  } catch (error) {
    if ((error as NodeError).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath)
  return stats.size
}

/**
 * Get file modification time
 */
export async function getFileModifiedTime(filePath: string): Promise<Date> {
  const stats = await fs.stat(filePath)
  return stats.mtime
}

/**
 * Copy file
 */
export async function copyFile(sourcePath: string, destPath: string): Promise<void> {
  await fs.copyFile(sourcePath, destPath)
}

/**
 * Move/rename file
 */
export async function moveFile(oldPath: string, newPath: string): Promise<void> {
  await fs.rename(oldPath, newPath)
}

/**
 * Read file and split into lines
 */
export async function readLines(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, '')
  return content.split('\n')
}

/**
 * Write lines to file
 */
export async function writeLines(filePath: string, lines: string[]): Promise<void> {
  const content = lines.join('\n')
  await writeFile(filePath, content)
}

/**
 * Get file extension
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath)
}

/**
 * Get filename without extension
 */
export function getFileNameWithoutExtension(filePath: string): string {
  return path.basename(filePath, path.extname(filePath))
}

// Default export for CommonJS compatibility
export default {
  readJson,
  writeJson,
  readFile,
  writeFile,
  atomicWrite,
  fileExists,
  ensureDir,
  deleteFile,
  deleteDir,
  listFiles,
  getFileSize,
  getFileModifiedTime,
  copyFile,
  moveFile,
  readLines,
  writeLines,
  getFileExtension,
  getFileNameWithoutExtension
}

