/**
 * Version Migration
 * Handles migration between prjct versions.
 */

import configManager from '../config-manager'
import type { Author, VersionMigrationResult } from './types'

/**
 * Check if a project needs migration
 */
export async function needsMigration(projectPath: string): Promise<boolean> {
  const structureMigration = await configManager.needsMigration(projectPath)
  if (structureMigration) return true

  const config = await configManager.readConfig(projectPath)
  if (config && config.version && config.version.startsWith('0.2.')) {
    return true
  }

  return false
}

/**
 * Migrate config from 0.2.x to 0.3.0 (move authors to global config)
 */
export async function migrateConfigTo030(projectPath: string): Promise<VersionMigrationResult> {
  const result: VersionMigrationResult = {
    success: false,
    message: '',
    oldVersion: null,
    newVersion: '0.3.0',
  }

  try {
    const localConfig = await configManager.readConfig(projectPath)
    if (!localConfig) {
      result.message = 'No config found'
      return result
    }

    result.oldVersion = localConfig.version || null
    const projectId = localConfig.projectId

    const globalConfig = await configManager.readGlobalConfig(projectId)
    if (globalConfig && globalConfig.authors && globalConfig.authors.length > 0) {
      const needsCleanup =
        localConfig.authors ||
        localConfig.author ||
        localConfig.version ||
        localConfig.created ||
        localConfig.lastSync

      if (needsCleanup) {
        delete localConfig.authors
        delete localConfig.author
        delete localConfig.version
        delete localConfig.created
        delete localConfig.lastSync
        await configManager.writeConfig(projectPath, localConfig)
      }
      result.success = true
      result.message = 'Authors already in global config, cleaned up local config'
      return result
    }

    let authors: Author[] = []
    const now = new Date().toISOString()

    if (localConfig.authors && Array.isArray(localConfig.authors)) {
      authors = localConfig.authors
    } else if (localConfig.author) {
      authors = [
        {
          name: localConfig.author.name || 'Unknown',
          email: localConfig.author.email || '',
          github: localConfig.author.github || '',
          firstContribution: localConfig.created || now,
          lastActivity: localConfig.lastSync || now,
        },
      ]
    } else {
      authors = [
        {
          name: 'Unknown',
          email: '',
          github: '',
          firstContribution: now,
          lastActivity: now,
        },
      ]
    }

    const newGlobalConfig = {
      projectId,
      authors,
      version: '0.3.0',
      created: localConfig.created || now,
      lastSync: now,
    }
    await configManager.writeGlobalConfig(projectId, newGlobalConfig)

    delete localConfig.authors
    delete localConfig.author
    delete localConfig.version
    delete localConfig.created
    delete localConfig.lastSync
    await configManager.writeConfig(projectPath, localConfig)

    result.success = true
    result.message = `Migrated ${authors.length} author(s) to global config`
    return result
  } catch (error) {
    result.message = `Migration failed: ${(error as Error).message}`
    return result
  }
}
