#!/usr/bin/env node

/**
 * Pre-Uninstall Script
 *
 * Runs automatically BEFORE `npm uninstall -g prjct-cli`.
 * Cleans up slash commands from all tracked AI editors.
 *
 * Flow:
 * 1. Check if running as global uninstall
 * 2. Read tracked editors from ~/.prjct-cli/config/installed-editors.json
 * 3. Remove all prjct commands from tracked editors
 * 4. Delete tracking configuration
 * 5. Clean exit (don't block uninstall)
 *
 * @version 0.4.4
 */

const chalk = require('chalk')
const { execSync } = require('child_process')
const path = require('path')

async function main() {
  try {
    // Check if this is a global uninstallation
    const isGlobal = await checkIfGlobalInstall()

    if (!isGlobal) {
      // Skip cleanup for local/dev uninstalls
      return
    }

    // Load editors config
    const editorsConfig = require('../core/editors-config')
    const configExists = await editorsConfig.configExists()

    if (!configExists) {
      // No config, nothing to clean up
      return
    }

    console.log(chalk.cyan('\n🧹 Cleaning up prjct commands from AI editors...\n'))

    // Load command installer
    const commandInstaller = require('../core/command-installer')

    // Uninstall from all tracked editors
    const results = await commandInstaller.uninstallFromAll()

    if (results.success && results.editors.length > 0) {
      console.log(chalk.green(`✅ Removed from: ${results.editors.join(', ')}`))
    }

    // Delete tracking config
    await editorsConfig.deleteConfig()

    console.log(chalk.green('\n✨ prjct-cli uninstalled cleanly\n'))

  } catch (error) {
    // Silently fail - don't block npm uninstall
    // Only log if explicitly debugging
    if (process.env.DEBUG) {
      console.error(chalk.red('[preuninstall] Error:'), error.message)
    }
  }
}

/**
 * Check if package is being uninstalled globally
 * @returns {Promise<boolean>} True if global uninstall
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
  // Silently fail - don't block npm uninstall
  if (process.env.DEBUG) {
    console.error('[preuninstall] Fatal error:', error)
  }
  process.exit(0) // Exit with success to not block npm uninstall
})
