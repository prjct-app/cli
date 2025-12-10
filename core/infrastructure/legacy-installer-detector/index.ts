/**
 * Legacy Installer Detector
 *
 * Detects and cleans up legacy curl-based installations from ~/.prjct-cli/
 *
 * @version 0.8.8
 */

import {
  legacyInstallDir,
  npmGlobalProjectsDir,
  isWindows,
  hasLegacyInstallation,
  getNpmGlobalPath,
  hasNpmInstallation,
  getLegacyVersion,
  needsCleanup,
} from './detection'

import { migrateProjectsData } from './migration'

import {
  cleanupLegacyInstallation,
  cleanupLegacyPATH,
  cleanupLegacySymlinks,
  getShellConfigFiles,
} from './cleanup'

import type { CleanupReport, CleanupOptions } from './types'
import { CYAN, GREEN, YELLOW, RED, DIM, NC } from './types'

class LegacyInstallerDetector {
  legacyInstallDir = legacyInstallDir
  npmGlobalProjectsDir = npmGlobalProjectsDir
  isWindows = isWindows

  hasLegacyInstallation = hasLegacyInstallation
  getNpmGlobalPath = getNpmGlobalPath
  hasNpmInstallation = hasNpmInstallation
  getLegacyVersion = getLegacyVersion
  needsCleanup = needsCleanup
  migrateProjectsData = migrateProjectsData
  cleanupLegacyInstallation = cleanupLegacyInstallation
  cleanupLegacyPATH = cleanupLegacyPATH
  cleanupLegacySymlinks = cleanupLegacySymlinks
  getShellConfigFiles = getShellConfigFiles

  /**
   * Perform complete legacy cleanup
   */
  async performCleanup(options: CleanupOptions = {}): Promise<CleanupReport> {
    const { verbose = true } = options

    const report: CleanupReport = {
      success: false,
      legacyVersion: null,
      hasNpm: false,
      steps: {
        projectsMigrated: 0,
        installationCleaned: false,
        pathCleaned: false,
        symlinksCleaned: false,
      },
      messages: [],
    }

    try {
      const hasLegacy = await hasLegacyInstallation()

      if (!hasLegacy) {
        report.success = true
        report.messages.push('No legacy installation found')
        return report
      }

      report.legacyVersion = await getLegacyVersion()
      report.hasNpm = await hasNpmInstallation()

      if (verbose) {
        console.log('')
        console.log(`${YELLOW}----------------------------------------${NC}`)
        console.log(`${YELLOW}Legacy curl installation detected${NC}`)
        console.log(`${YELLOW}----------------------------------------${NC}`)
        console.log('')
        console.log(`   ${DIM}Version: ${report.legacyVersion || 'unknown'}${NC}`)
        console.log(`   ${DIM}Location: ~/.prjct-cli/${NC}`)
        console.log('')

        if (!report.hasNpm) {
          console.log(`${RED}npm global installation not found${NC}`)
          console.log('')
          console.log(`${CYAN}Install prjct-cli via npm first:${NC}`)
          console.log(`   ${GREEN}npm install -g prjct-cli${NC}`)
          console.log('')
          return report
        }

        console.log(`${CYAN}Migrating to npm installation...${NC}`)
        console.log('')
      }

      // Step 1: Migrate projects data
      if (verbose) console.log(`   ${DIM}Migrating projects data...${NC}`)
      const projectsMigration = await migrateProjectsData()
      report.steps.projectsMigrated = projectsMigration.projectsMigrated
      report.messages.push(projectsMigration.message)
      if (verbose) {
        const icon = projectsMigration.success ? `${GREEN}✓${NC}` : `${RED}✗${NC}`
        console.log(`   ${icon} ${projectsMigration.message}`)
      }

      // Step 2: Clean legacy installation
      if (verbose) console.log(`   ${DIM}Removing legacy files...${NC}`)
      const installCleanup = await cleanupLegacyInstallation()
      report.steps.installationCleaned = installCleanup.success
      report.messages.push(installCleanup.message)
      if (verbose) {
        const icon = installCleanup.success ? `${GREEN}✓${NC}` : `${RED}✗${NC}`
        console.log(`   ${icon} ${installCleanup.message}`)
      }

      // Step 3: Clean PATH entries
      if (verbose) console.log(`   ${DIM}Cleaning shell PATH...${NC}`)
      const pathCleanup = await cleanupLegacyPATH()
      report.steps.pathCleaned = pathCleanup.success
      report.messages.push(pathCleanup.message)
      if (verbose) {
        const icon = pathCleanup.success ? `${GREEN}✓${NC}` : `${RED}✗${NC}`
        console.log(`   ${icon} ${pathCleanup.message}`)
      }

      // Step 4: Clean symlinks
      if (verbose) console.log(`   ${DIM}Cleaning symlinks...${NC}`)
      const symlinkCleanup = await cleanupLegacySymlinks()
      report.steps.symlinksCleaned = symlinkCleanup.success
      report.messages.push(symlinkCleanup.message)
      if (verbose) {
        const icon = symlinkCleanup.success ? `${GREEN}✓${NC}` : `${RED}✗${NC}`
        console.log(`   ${icon} ${symlinkCleanup.message}`)
      }

      if (verbose) {
        console.log('')
        console.log(`${GREEN}Migration complete!${NC}`)
        console.log('')
        console.log(`${DIM}Next steps:${NC}`)
        if (pathCleanup.filesModified && pathCleanup.filesModified > 0) {
          console.log(`   ${CYAN}1. Reload your shell:${NC}`)
          console.log(`      source ~/.zshrc  ${DIM}(or ~/.bashrc)${NC}`)
          console.log('')
        }
        const stepNum = pathCleanup.filesModified && pathCleanup.filesModified > 0 ? '2' : '1'
        console.log(`   ${CYAN}${stepNum}. Verify installation:${NC}`)
        console.log(`      which prjct  ${DIM}(should show npm path)${NC}`)
        console.log(`      prjct --version`)
        console.log('')
        console.log(`${YELLOW}----------------------------------------${NC}`)
        console.log('')
      }

      report.success = true
      return report
    } catch (error) {
      report.messages.push(`Cleanup failed: ${(error as Error).message}`)
      return report
    }
  }
}

const legacyInstallerDetector = new LegacyInstallerDetector()
export default legacyInstallerDetector
