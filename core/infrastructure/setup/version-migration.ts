/**
 * Migrate existing project records to the current CLI version. This
 * clears the status-line "outdated" warning across all known projects
 * after `npm update -g prjct-cli`.
 *
 * Best-effort — projects with corrupt DB rows are silently skipped.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import chalk from 'chalk'
import { prjctDb } from '../../storage/database'
import { getErrorMessage, isNotFoundError } from '../../types/fs'
import { fileExists } from '../../utils/file-helper'
import log from '../../utils/logger'
import { VERSION } from '../../utils/version'

export async function migrateProjectsCliVersion(): Promise<void> {
  try {
    const projectsDir = path.join(os.homedir(), '.prjct-cli', 'projects')

    if (!(await fileExists(projectsDir))) {
      return
    }

    const projectDirs = (await fs.readdir(projectsDir, { withFileTypes: true }))
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)

    let migrated = 0

    for (const projectId of projectDirs) {
      try {
        const project = prjctDb.getDoc<Record<string, unknown>>(projectId, 'project')
        if (!project) continue

        if (project.cliVersion !== VERSION) {
          project.cliVersion = VERSION
          prjctDb.setDoc(projectId, 'project', project)
          migrated++
        }
      } catch {
        // Skip projects with database issues
      }
    }

    if (migrated > 0) {
      console.log(`   ${chalk.green('✓')} Updated ${migrated} project(s) to v${VERSION}`)
    }
  } catch (error) {
    if (!isNotFoundError(error)) {
      // Log unexpected errors but don't crash - migration is optional
      log.warn(`Migration warning: ${getErrorMessage(error)}`)
    }
  }
}
