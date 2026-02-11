/**
 * Update Commands: update
 * Migrates all prjct projects from JSON → SQLite and cleans up legacy files.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import chalk from 'chalk'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { migrateJsonToSqlite, sweepLegacyJson } from '../storage/migrate-json'
import type { CommandResult } from '../types'
import { getErrorMessage } from '../types/fs'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

interface UpdateOptions {
  all?: boolean
  'dry-run'?: boolean
}

export class UpdateCommands extends PrjctCommandsBase {
  /**
   * prjct update [--all] [--dry-run]
   *
   * Migrates JSON storage files to SQLite and cleans up leftovers.
   * Without --all: migrates current project only.
   * With --all: scans ~/.prjct-cli/projects/ for all projects.
   */
  async update(
    options: UpdateOptions = {},
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    const dryRun = options['dry-run'] === true
    const all = options.all === true

    try {
      const projectIds = all
        ? await this.getAllProjectIds()
        : await this.getCurrentProjectId(projectPath)

      if (projectIds.length === 0) {
        out.warn('no projects found')
        return { success: false, message: 'No prjct projects found to update' }
      }

      if (dryRun) {
        console.log(chalk.dim(`[dry-run] Would update ${projectIds.length} project(s)\n`))
      }

      let totalMigrated = 0
      let totalSwept = 0
      let errors = 0

      for (const projectId of projectIds) {
        const label = `${projectId.slice(0, 8)}...`

        if (dryRun) {
          console.log(`  ${chalk.dim('would update')} ${label}`)
          continue
        }

        try {
          // Step 1: Run full migration (safe to call multiple times)
          const migrationResult = await migrateJsonToSqlite(projectId)

          // Step 2: Sweep any leftover JSON files
          const swept = await sweepLegacyJson(projectId)

          const migrated = migrationResult.migratedFiles.length
          totalMigrated += migrated
          totalSwept += swept

          if (migrated > 0 || swept > 0) {
            console.log(
              `  ${chalk.green('✓')} ${label}: migrated ${migrated} files, swept ${swept} leftovers`
            )
          } else {
            console.log(`  ${chalk.green('✓')} ${label}: already up to date`)
          }

          if (migrationResult.errors.length > 0) {
            for (const err of migrationResult.errors) {
              console.log(`    ${chalk.yellow('⚠')} ${err.file}: ${err.error}`)
            }
            errors += migrationResult.errors.length
          }
        } catch (err) {
          console.log(`  ${chalk.red('✗')} ${label}: ${getErrorMessage(err)}`)
          errors++
        }
      }

      if (dryRun) {
        out.done(`dry run complete (${projectIds.length} projects)`)
        return { success: true, message: `Would update ${projectIds.length} project(s)` }
      }

      // Summary
      const summary = []
      if (totalMigrated > 0) summary.push(`${totalMigrated} files migrated`)
      if (totalSwept > 0) summary.push(`${totalSwept} leftovers swept`)
      if (errors > 0) summary.push(`${errors} errors`)

      if (summary.length === 0) {
        out.done(`${projectIds.length} project(s) already up to date`)
      } else {
        out.done(`${projectIds.length} project(s) updated: ${summary.join(', ')}`)
      }

      return {
        success: errors === 0,
        message: `Updated ${projectIds.length} project(s)`,
      }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Get current project's ID from cwd
   */
  private async getCurrentProjectId(projectPath: string): Promise<string[]> {
    const projectId = await configManager.getProjectId(projectPath)
    return projectId ? [projectId] : []
  }

  /**
   * Scan ~/.prjct-cli/projects/ for all project directories
   */
  private async getAllProjectIds(): Promise<string[]> {
    const projectsDir = path.join(pathManager.getGlobalBasePath(), 'projects')

    try {
      const entries = await fs.readdir(projectsDir, { withFileTypes: true })
      return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
    } catch {
      return []
    }
  }
}
