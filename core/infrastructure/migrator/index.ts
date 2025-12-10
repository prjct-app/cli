/**
 * Migrator
 * Handles migrations between prjct versions and structures.
 *
 * @module infrastructure/migrator
 * @version 0.3.0
 */

import fs from 'fs/promises'
import path from 'path'
import pathManager from '../path-manager'
import configManager from '../config-manager'
import authorDetector from '../author-detector'

import type {
  Author,
  MigrationResult,
  MigrationOptions,
  MigrationSummary,
  MigrateAllOptions,
  ProjectInfo,
  LayerCounts
} from './types'

import { needsMigration, migrateConfigTo030 } from './version-migration'
import { migrateFiles } from './file-operations'
import { validateMigration, cleanupLegacyDirectories, checkStatus } from './validation'
import { findAllProjects } from './project-scanner'
import { generateReport, generateMigrationSummary } from './reports'

/**
 * Handles version migrations and project structure updates.
 * Supports legacy -> global storage migration and config version upgrades.
 */
class Migrator {
  // Re-export helper methods
  needsMigration = needsMigration
  migrateConfigTo030 = migrateConfigTo030
  validateMigration = validateMigration
  cleanupLegacyDirectories = cleanupLegacyDirectories
  checkStatus = checkStatus
  findAllProjects = findAllProjects
  generateReport = generateReport
  generateMigrationSummary = generateMigrationSummary

  /**
   * Perform the complete migration process
   */
  async migrate(projectPath: string, options: MigrationOptions = {}): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      projectId: null,
      filesCopied: 0,
      layerCounts: {
        core: 0,
        progress: 0,
        planning: 0,
        analysis: 0,
        memory: 0,
        other: 0,
      },
      config: null,
      author: null,
      issues: [],
      dryRun: options.dryRun || false,
    }

    try {
      const config = await configManager.readConfig(projectPath)
      if (config && config.version && config.version.startsWith('0.2.')) {
        const versionMigration = await migrateConfigTo030(projectPath)
        result.success = versionMigration.success
        result.projectId = config.projectId
        result.filesCopied = 0
        result.issues = versionMigration.success ? [] : [versionMigration.message]
        return result
      }

      const needsStructuralMigration = await configManager.needsMigration(projectPath)
      if (!needsStructuralMigration) {
        result.success = false
        result.issues.push('No migration needed - either no legacy structure or already migrated')
        return result
      }

      const detectedAuthor = await authorDetector.detect()
      result.author = {
        name: detectedAuthor.name,
        email: detectedAuthor.email,
        github: detectedAuthor.github
      }

      const projectId = pathManager.generateProjectId(projectPath)
      result.projectId = projectId

      if (options.dryRun) {
        result.success = true
        result.issues.push('DRY RUN - No changes were made')
        return result
      }

      await pathManager.ensureProjectStructure(projectId)

      // Convert null to undefined for createConfig
      const authorForConfig = {
        name: result.author.name || undefined,
        email: result.author.email || undefined,
        github: result.author.github || undefined
      }
      result.config = await configManager.createConfig(projectPath, authorForConfig)

      const legacyPath = pathManager.getLegacyPrjctPath(projectPath)
      const globalPath = pathManager.getGlobalProjectPath(projectId)

      const migrationStats = await migrateFiles(legacyPath, globalPath)
      result.filesCopied = migrationStats.fileCount
      result.layerCounts = migrationStats.layerCounts

      const validation = await validateMigration(projectId)
      result.issues = validation.issues

      if (!validation.valid) {
        result.success = false
        return result
      }

      if (options.removeLegacy) {
        await fs.rm(legacyPath, { recursive: true, force: true })
        result.legacyRemoved = true
      } else if (options.cleanupLegacy) {
        await cleanupLegacyDirectories(projectPath)
        result.legacyCleaned = true
      }

      result.success = true
      return result
    } catch (error) {
      result.success = false
      result.issues.push(`Migration error: ${(error as Error).message}`)
      return result
    }
  }

  /**
   * Migrate all projects with legacy .prjct directories
   */
  async migrateAll(options: MigrateAllOptions = {}): Promise<MigrationSummary> {
    const {
      deepScan = false,
      removeLegacy = false,
      cleanupLegacy = false,
      dryRun = false,
      interactive = false,
      onProgress = null,
    } = options

    const summary: MigrationSummary = {
      success: false,
      totalFound: 0,
      alreadyMigrated: 0,
      successfullyMigrated: 0,
      failed: 0,
      skipped: 0,
      projects: [],
      errors: [],
      dryRun,
    }

    try {
      if (onProgress) onProgress({ phase: 'scanning', message: 'Searching for projects...' })
      const projectPaths = await findAllProjects({ deepScan })
      summary.totalFound = projectPaths.length

      if (projectPaths.length === 0) {
        summary.success = true
        return summary
      }

      for (let i = 0; i < projectPaths.length; i++) {
        const projectPath = projectPaths[i]
        const projectName = path.basename(projectPath)

        if (onProgress) {
          onProgress({
            phase: 'checking',
            message: `Checking ${projectName} (${i + 1}/${projectPaths.length})`,
            current: i + 1,
            total: projectPaths.length,
          })
        }

        try {
          const status = await checkStatus(projectPath)

          const projectInfo: ProjectInfo = {
            path: projectPath,
            name: projectName,
            status: status.status,
          }

          if (status.status === 'migrated' || status.status === 'new') {
            projectInfo.result = 'skipped'
            projectInfo.reason =
              status.status === 'migrated' ? 'Already migrated' : 'Not initialized'
            summary.alreadyMigrated++
          } else if (status.needsMigration) {
            if (interactive && onProgress) {
              const shouldMigrate = await onProgress({
                phase: 'confirm',
                message: `Migrate ${projectName}?`,
                projectPath,
              })
              if (!shouldMigrate) {
                projectInfo.result = 'skipped'
                projectInfo.reason = 'User skipped'
                summary.skipped++
                summary.projects.push(projectInfo)
                continue
              }
            }

            if (onProgress) {
              onProgress({
                phase: 'migrating',
                message: `Migrating ${projectName}...`,
                current: i + 1,
                total: projectPaths.length,
              })
            }

            const migrationResult = await this.migrate(projectPath, {
              removeLegacy,
              cleanupLegacy,
              dryRun,
            })

            projectInfo.projectId = migrationResult.projectId || undefined
            projectInfo.filesCopied = migrationResult.filesCopied
            projectInfo.layerCounts = migrationResult.layerCounts

            if (migrationResult.success) {
              projectInfo.result = 'success'
              summary.successfullyMigrated++
            } else {
              projectInfo.result = 'failed'
              projectInfo.errors = migrationResult.issues
              summary.failed++
              summary.errors.push({
                project: projectName,
                path: projectPath,
                issues: migrationResult.issues,
              })
            }
          }

          summary.projects.push(projectInfo)
        } catch (error) {
          summary.failed++
          summary.errors.push({
            project: projectName,
            path: projectPath,
            issues: [(error as Error).message],
          })
          summary.projects.push({
            path: projectPath,
            name: projectName,
            result: 'failed',
            errors: [(error as Error).message],
          })
        }
      }

      summary.success = summary.failed === 0
      return summary
    } catch (error) {
      summary.success = false
      summary.errors.push({
        project: 'global',
        issues: [(error as Error).message],
      })
      return summary
    }
  }
}

const migrator = new Migrator()
export default migrator
export * from './types'
