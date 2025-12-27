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

async function main() {
  try {
    // Detect if this is a global install
    const isGlobal = detectGlobalInstall()

    if (!isGlobal) {
      // Skip postinstall for local development installs
      return
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
