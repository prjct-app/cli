/**
 * Skill Lock File Service
 *
 * Manages a lock file that tracks remotely-installed skills for
 * reproducibility and update detection.
 *
 * Lock file location: ~/.prjct-cli/skills/.skill-lock.json
 *
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// =============================================================================
// Types
// =============================================================================

export interface SkillLockSource {
  type: 'github' | 'local' | 'registry'
  url: string
  sha?: string
}

export interface SkillLockEntry {
  name: string
  source: SkillLockSource
  installedAt: string
  filePath: string
}

export interface SkillLockFile {
  version: 1
  generatedAt: string
  skills: Record<string, SkillLockEntry>
}

// =============================================================================
// Lock File Service
// =============================================================================

const LOCK_FILE_NAME = '.skill-lock.json'

function getLockFilePath(): string {
  return path.join(os.homedir(), '.prjct-cli', 'skills', LOCK_FILE_NAME)
}

function createEmptyLockFile(): SkillLockFile {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    skills: {},
  }
}

/**
 * Read the lock file, returning an empty lock file if it doesn't exist
 */
async function read(): Promise<SkillLockFile> {
  try {
    const content = await fs.readFile(getLockFilePath(), 'utf-8')
    return JSON.parse(content) as SkillLockFile
  } catch {
    return createEmptyLockFile()
  }
}

/**
 * Write the lock file to disk
 */
async function write(lockFile: SkillLockFile): Promise<void> {
  const lockPath = getLockFilePath()
  await fs.mkdir(path.dirname(lockPath), { recursive: true })
  lockFile.generatedAt = new Date().toISOString()
  await fs.writeFile(lockPath, JSON.stringify(lockFile, null, 2), 'utf-8')
}

/**
 * Add or update a skill entry in the lock file
 */
async function addEntry(entry: SkillLockEntry): Promise<void> {
  const lockFile = await read()
  lockFile.skills[entry.name] = entry
  await write(lockFile)
}

/**
 * Remove a skill entry from the lock file
 */
async function removeEntry(name: string): Promise<boolean> {
  const lockFile = await read()
  if (!(name in lockFile.skills)) return false
  delete lockFile.skills[name]
  await write(lockFile)
  return true
}

/**
 * Get a single skill entry
 */
async function getEntry(name: string): Promise<SkillLockEntry | null> {
  const lockFile = await read()
  return lockFile.skills[name] || null
}

/**
 * Get all entries
 */
async function getAll(): Promise<Record<string, SkillLockEntry>> {
  const lockFile = await read()
  return lockFile.skills
}

/**
 * Get the lock file path (for display purposes)
 */
function getPath(): string {
  return getLockFilePath()
}

export const skillLock = {
  read,
  write,
  addEntry,
  removeEntry,
  getEntry,
  getAll,
  getPath,
}

export default skillLock
