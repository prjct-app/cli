/**
 * Migration - Project Data Migration
 */

import fs from 'fs/promises'
import path from 'path'
import { legacyInstallDir, npmGlobalProjectsDir } from './detection'
import type { MigrationResult } from './types'

/**
 * Copy directory recursively
 */
async function copyDirectory(source: string, destination: string): Promise<void> {
  await fs.mkdir(destination, { recursive: true })

  const entries = await fs.readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name)
    const destPath = path.join(destination, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath)
    } else {
      await fs.copyFile(sourcePath, destPath)
    }
  }
}

/**
 * Migrate projects data from legacy location to npm location
 */
export async function migrateProjectsData(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    projectsMigrated: 0,
    message: '',
  }

  try {
    const legacyProjectsDir = path.join(legacyInstallDir, 'projects')

    // Check if legacy projects directory exists
    try {
      await fs.access(legacyProjectsDir)
    } catch {
      result.success = true
      result.message = 'No projects data to migrate'
      return result
    }

    // Ensure npm global projects directory exists
    await fs.mkdir(npmGlobalProjectsDir, { recursive: true })

    // Read all project directories
    const projectDirs = await fs.readdir(legacyProjectsDir, { withFileTypes: true })

    for (const entry of projectDirs) {
      if (!entry.isDirectory()) continue

      const legacyProjectPath = path.join(legacyProjectsDir, entry.name)
      const npmProjectPath = path.join(npmGlobalProjectsDir, entry.name)

      // Check if project already exists in npm location
      try {
        await fs.access(npmProjectPath)
        // Already exists, skip
        continue
      } catch {
        // Doesn't exist, copy it
        await copyDirectory(legacyProjectPath, npmProjectPath)
        result.projectsMigrated++
      }
    }

    result.success = true
    result.message =
      result.projectsMigrated > 0
        ? `Migrated ${result.projectsMigrated} project(s) to npm global location`
        : 'All projects already in npm location'

    return result
  } catch (error) {
    result.message = `Migration failed: ${(error as Error).message}`
    return result
  }
}
