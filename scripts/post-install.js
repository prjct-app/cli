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
 * @version 0.4.2
 */

const path = require('path')
const chalk = require('chalk')
const { execSync } = require('child_process')

async function main() {
  try {
    // Check if this is a global installation
    const isGlobal = await checkIfGlobalInstall()

    if (!isGlobal) {
      // Skip post-install for local/dev installations
      return
    }

    // Load editors config
    const editorsConfig = require('../core/editors-config')
    const configExists = await editorsConfig.configExists()

    if (!configExists) {
      // First-time install, no editors tracked yet
      // User will configure editors during `prjct init` or `prjct install`
      return
    }

    // Get current package version
    const packageJson = require('../package.json')
    const currentVersion = packageJson.version

    // Check if version has changed
    const versionChanged = await editorsConfig.hasVersionChanged(currentVersion)

    if (!versionChanged) {
      // Same version, no update needed
      return
    }

    // Get tracked editors and paths
    const trackedEditors = await editorsConfig.getTrackedEditors()
    const editorPaths = await editorsConfig.getEditorPaths()

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
