/**
 * Reports
 * Generates migration reports.
 */

import pathManager from '../path-manager'
import authorDetector from '../author-detector'
import type { MigrationResult, MigrationSummary } from './types'

/**
 * Generate a migration report
 */
export function generateReport(result: MigrationResult): string {
  const lines: string[] = []

  lines.push('Migration Report')
  lines.push('---')

  if (result.dryRun) {
    lines.push('DRY RUN MODE - No changes were made')
    lines.push('')
  }

  if (result.success) {
    lines.push('Migration successful!')
    lines.push('')
    lines.push(`Project ID: ${result.projectId}`)
    lines.push(`Author: ${authorDetector.formatAuthor(result.author!)}`)
    lines.push(`Files migrated: ${result.filesCopied}`)
    lines.push('')
    lines.push('Files by layer:')
    for (const [layer, count] of Object.entries(result.layerCounts)) {
      if (count > 0) {
        lines.push(`   - ${layer}: ${count} files`)
      }
    }
    lines.push('')
    lines.push(`Data location: ${result.config?.dataPath}`)

    if (result.legacyRemoved) {
      lines.push('')
      lines.push('Legacy .prjct directory removed')
    }
  } else {
    lines.push('Migration failed!')
    lines.push('')
    if (result.issues.length > 0) {
      lines.push('Issues:')
      for (const issue of result.issues) {
        lines.push(`   - ${issue}`)
      }
    }
  }

  lines.push('---')

  return lines.join('\n')
}

/**
 * Generate a summary report for migrateAll results
 */
export function generateMigrationSummary(summary: MigrationSummary): string {
  const lines: string[] = []

  lines.push('Global Migration Report')
  lines.push('---')

  if (summary.dryRun) {
    lines.push('DRY RUN MODE - No changes were made')
    lines.push('')
  }

  lines.push(`Found: ${summary.totalFound} projects`)
  lines.push(`Successfully migrated: ${summary.successfullyMigrated}`)
  lines.push(`Already migrated: ${summary.alreadyMigrated}`)
  if (summary.skipped > 0) {
    lines.push(`Skipped: ${summary.skipped}`)
  }
  if (summary.failed > 0) {
    lines.push(`Failed: ${summary.failed}`)
  }
  lines.push('')

  if (summary.successfullyMigrated > 0) {
    lines.push('Successfully Migrated:')
    summary.projects
      .filter((p) => p.result === 'success')
      .forEach((project) => {
        lines.push(`   - ${project.name}`)
        lines.push(`     Files: ${project.filesCopied} | ID: ${project.projectId}`)
      })
    lines.push('')
  }

  if (summary.errors.length > 0) {
    lines.push('Errors:')
    summary.errors.forEach((error) => {
      lines.push(`   - ${error.project}`)
      error.issues.forEach((issue) => lines.push(`     - ${issue}`))
    })
    lines.push('')
  }

  if (summary.success && summary.successfullyMigrated > 0) {
    lines.push('All projects migrated successfully!')
    lines.push(`Global data location: ${pathManager.getGlobalBasePath()}`)
  } else if (summary.totalFound === 0) {
    lines.push('No legacy projects found')
  } else if (summary.alreadyMigrated === summary.totalFound) {
    lines.push('All projects already migrated')
  }

  lines.push('---')

  return lines.join('\n')
}
