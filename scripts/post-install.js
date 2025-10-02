#!/usr/bin/env node

/**
 * Post-Install Script
 *
 * Runs automatically after `npm install -g prjct-cli` or `npm update -g prjct-cli`.
 * Auto-updates slash commands in all previously configured editors.
 *
 * Flow:
 * 1. Check if running as global install
 * 2. Read tracked editors from ~/.prjct-cli/config/installed-editors.json
 * 3. If config exists and version changed, force-update commands in tracked editors
 * 4. Update version in config
 *
 * @version 0.4.4
 */

const path = require('path')
const chalk = require('chalk')
const { execSync } = require('child_process')

async function main() {
  try {
    // Get current package version
    const packageJson = require('../package.json')
    const currentVersion = packageJson.version

    // Check if this is a global installation
    const isGlobal = await checkIfGlobalInstall()

    if (!isGlobal) {
      // Skip post-install for local/dev installations
      if (process.env.DEBUG) {
        console.log(chalk.gray('[post-install] Skipping - not a global install'))
      }
      return
    }

    // Load editors config
    const editorsConfig = require('../core/editors-config')
    const configExists = await editorsConfig.configExists()

    if (!configExists) {
      // First-time install - show welcome message
      console.log(chalk.cyan('\n✨ prjct-cli installed successfully!\n'))
      console.log(chalk.gray('Run: ') + chalk.cyan('prjct start') + chalk.gray(' to get started\n'))
      return
    }

    // Check if version has changed
    const versionChanged = await editorsConfig.hasVersionChanged(currentVersion)

    if (!versionChanged) {
      // Same version, no update needed
      return
    }

    // Get tracked editors
    const trackedEditors = await editorsConfig.getTrackedEditors()

    if (trackedEditors.length === 0) {
      // No editors tracked yet
      return
    }

    console.log(chalk.cyan('\n🔄 Updating prjct commands in configured editors...\n'))

    // Load command installer
    const commandInstaller = require('../core/command-installer')

    // Force-update commands in all tracked editors
    const results = await commandInstaller.installToSelected(trackedEditors, true)

    if (results.success) {
      console.log(chalk.green(`✅ Updated commands in: ${results.editors.join(', ')}`))
      console.log(chalk.gray(`   Commands updated: ${results.totalUpdated}`))
    } else {
      console.log(chalk.yellow('⚠️  Some editors could not be updated'))
    }

    // Update version in config
    await editorsConfig.updateVersion(currentVersion)

    // Auto-migrate legacy projects (v0.1.0 → v0.4.4)
    try {
      console.log(chalk.cyan('\n🔍 Checking for legacy projects to migrate...\n'))

      const migrator = require('../core/migrator')

      // Quick scan of common directories (not entire home directory)
      const summary = await migrator.migrateAll({
        deepScan: false,        // Only scan common dirs (fast)
        removeLegacy: false,    // Keep legacy dirs for safety
        cleanupLegacy: true,    // Remove old dirs but keep config
        dryRun: false,          // Actually perform migration
        interactive: false      // No user prompts during npm install
      })

      if (summary.successfullyMigrated > 0) {
        console.log(chalk.green(`✅ Migrated ${summary.successfullyMigrated} legacy project(s) to new structure`))
        console.log(chalk.gray(`   Data location: ~/.prjct-cli/projects/`))
      } else if (summary.totalFound > 0 && summary.alreadyMigrated === summary.totalFound) {
        console.log(chalk.gray('ℹ️  All projects already using new structure'))
      }
    } catch (migrationError) {
      // Don't block install if migration fails
      if (process.env.DEBUG) {
        console.error(chalk.yellow('[post-install] Migration warning:'), migrationError.message)
      }
    }

    console.log(chalk.cyan(`\n✨ prjct-cli ${currentVersion} is ready!\n`))

  } catch (error) {
    // Silently fail - don't block npm install
    // Only log if explicitly debugging
    if (process.env.DEBUG) {
      console.error(chalk.red('[post-install] Error:'), error.message)
    }
  }
}

/**
 * Check if package is being installed globally
 * @returns {Promise<boolean>} True if global install
 */
async function checkIfGlobalInstall() {
  try {
    // Get npm global root directory
    const globalRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim()

    // Get current package directory
    const currentDir = path.resolve(__dirname, '..')

    // Check if current directory is under global node_modules
    return currentDir.startsWith(globalRoot)
  } catch {
    return false
  }
}

// Run main function
main().catch(error => {
  // Silently fail - don't block npm install
  if (process.env.DEBUG) {
    console.error('[post-install] Fatal error:', error)
  }
  process.exit(0) // Exit with success to not block npm install
})
