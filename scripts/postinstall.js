#!/usr/bin/env node

/**
 * Post-install hook for prjct-cli
 *
 * 1. Builds dist/ for Node.js users (if bun not available)
 * 2. Runs setup if npm scripts are enabled
 *
 * @version 1.0.0
 */

const path = require('path')
const { execSync } = require('child_process')
const fs = require('fs')

/**
 * Check if bun is available
 */
function isBunAvailable() {
  try {
    execSync('bun --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Build dist/ for Node.js
 */
async function buildForNode() {
  const rootDir = path.resolve(__dirname, '..')
  const distDir = path.join(rootDir, 'dist')

  // Skip if dist already exists (e.g., published package)
  if (fs.existsSync(path.join(distDir, 'bin', 'prjct.js'))) {
    return
  }

  console.log('Building for Node.js compatibility...')

  try {
    // Run build script
    execSync('node scripts/build.js', {
      cwd: rootDir,
      stdio: 'inherit',
    })
  } catch (error) {
    console.warn('Warning: Build failed. CLI will build on first use.')
    // Non-fatal - the wrapper script will build on first run
  }
}

/**
 * Update CLI_VERSION in existing statusline script
 * This preserves customizations while ensuring version is current
 * Checks both the actual script location and Claude's symlink
 */
function updateStatusLineVersion() {
  try {
    // Check the actual script location first (preferred)
    const homeDir = process.env.HOME || require('os').homedir()
    const prjctStatusLinePath = path.join(homeDir, '.prjct-cli', 'statusline', 'statusline.sh')
    // Fallback to Claude's location (might be a direct file or symlink)
    const claudeStatusLinePath = path.join(homeDir, '.claude', 'prjct-statusline.sh')

    // Determine which path to update
    let statusLinePath = null
    if (fs.existsSync(prjctStatusLinePath)) {
      statusLinePath = prjctStatusLinePath
    } else if (fs.existsSync(claudeStatusLinePath)) {
      // Check if it's a symlink - if so, follow it
      const stats = fs.lstatSync(claudeStatusLinePath)
      if (stats.isSymbolicLink()) {
        const target = fs.readlinkSync(claudeStatusLinePath)
        if (fs.existsSync(target)) {
          statusLinePath = target
        }
      } else {
        statusLinePath = claudeStatusLinePath
      }
    }

    if (!statusLinePath) {
      return { updated: false, reason: 'not_exists' }
    }

    const content = fs.readFileSync(statusLinePath, 'utf8')
    const packageJson = require('../package.json')
    const newVersion = packageJson.version

    if (!content.includes('CLI_VERSION=')) {
      // Script exists but no CLI_VERSION - needs to be replaced by setup
      // Don't modify here, let setup.run() handle the replacement
      return { updated: false, reason: 'needs_replacement' }
    }

    const versionMatch = content.match(/CLI_VERSION="([^"]*)"/)
    if (versionMatch && versionMatch[1] === newVersion) {
      return { updated: false, reason: 'already_current' }
    }

    // Update in-place using string replacement
    const updatedContent = content.replace(
      /CLI_VERSION="[^"]*"/,
      `CLI_VERSION="${newVersion}"`
    )
    fs.writeFileSync(statusLinePath, updatedContent, { mode: 0o755 })

    return { updated: true, version: newVersion, path: statusLinePath, action: 'updated' }
  } catch (error) {
    return { updated: false, reason: 'error', error: error.message }
  }
}

async function main() {
  try {
    // Detect if this is a global install
    const isGlobal = detectGlobalInstall()

    if (!isGlobal) {
      // Skip postinstall for local development installs
      return
    }

    // Update statusline version FIRST (before full setup)
    // This ensures existing customized scripts get version updates
    const statusLineResult = updateStatusLineVersion()
    if (statusLineResult.updated) {
      console.log(`   Updated statusline to v${statusLineResult.version}`)
    }

    // Build for Node.js if bun is not available
    if (!isBunAvailable()) {
      await buildForNode()
    }

    // Run setup (all logic is in core/infrastructure/setup.js)
    const setup = require('../core/infrastructure/setup')
    await setup.run()

  } catch (error) {
    // Silent failure - setup will run on first use anyway
    // Don't fail the install if post-install has issues
    process.exit(0)
  }
}

/**
 * Detect if this is a global npm install
 */
function detectGlobalInstall() {
  // Check if we're being installed globally
  const npmConfig = process.env.npm_config_global
  if (npmConfig === 'true') {
    return true
  }

  // Check if install location is in global node_modules
  const installPath = __dirname
  const globalPaths = [
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules',
    path.join(process.env.HOME || '', '.npm-global', 'lib', 'node_modules'),
    path.join(process.env.HOME || '', '.nvm'),
    path.join(process.env.APPDATA || '', 'npm', 'node_modules')
  ]

  return globalPaths.some(globalPath => installPath.includes(globalPath))
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message)
    process.exit(0) // Don't fail npm install
  })
}

module.exports = main
