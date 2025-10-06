#!/usr/bin/env node

/**
 * Post-install hook for prjct-cli (OPTIONAL)
 *
 * Intenta ejecutar setup si npm scripts están habilitados.
 * Si falla o no se ejecuta, no hay problema - el setup se ejecutará
 * automáticamente en el primer uso del CLI (como Astro, Vite, etc.)
 *
 * Este hook es una optimización pero NO es crítico.
 *
 * @version 0.8.5
 */

const path = require('path')
const setup = require('../core/infrastructure/setup')

async function main() {
  try {
    // Detect if this is a global install
    const isGlobal = detectGlobalInstall()

    if (!isGlobal) {
      // Skip postinstall for local development installs
      return
    }

    // Run setup (all logic is in core/infrastructure/setup.js)
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
