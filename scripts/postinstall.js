#!/usr/bin/env node

/**
 * Post-install hook for prjct-cli
 *
 * Runs setup after npm install:
 * 1. Syncs commands to ~/.claude/commands/p/
 * 2. Installs global CLAUDE.md config
 * 3. Installs statusline
 * 4. Updates project versions
 *
 * IMPORTANT: This script uses COMPILED JavaScript from dist/
 * It does NOT require TypeScript directly.
 *
 * @version 2.0.0
 */

const path = require('path')
const { execSync } = require('child_process')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')

/**
 * Detect if this is a global npm install
 */
function isGlobalInstall() {
  // Check npm config (most reliable)
  if (process.env.npm_config_global === 'true') {
    return true
  }

  // Check install location against known global paths
  const installPath = __dirname
  const globalPaths = [
    // macOS Intel
    '/usr/local/lib/node_modules',
    // macOS M1/M2 (Homebrew)
    '/opt/homebrew/lib/node_modules',
    // Linux
    '/usr/lib/node_modules',
    // Custom npm prefix
    path.join(process.env.HOME || '', '.npm-global', 'lib', 'node_modules'),
    // nvm
    path.join(process.env.HOME || '', '.nvm'),
    // Windows
    path.join(process.env.APPDATA || '', 'npm', 'node_modules'),
    // pnpm global
    path.join(process.env.HOME || '', '.local', 'share', 'pnpm'),
    // Volta
    path.join(process.env.HOME || '', '.volta'),
  ]

  if (globalPaths.some((p) => installPath.includes(p))) {
    return true
  }

  // Fallback: if we're in ANY node_modules that's not in cwd, assume global
  if (installPath.includes('node_modules') && !installPath.includes(process.cwd())) {
    return true
  }

  return false
}

/**
 * Check if bun is available
 */
function hasBun() {
  try {
    execSync('bun --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Run setup using compiled JavaScript (for Node.js users)
 */
async function runSetupCompiled() {
  const setupPath = path.join(ROOT, 'dist', 'core', 'infrastructure', 'setup.js')

  if (!fs.existsSync(setupPath)) {
    console.log('   Setup module not found. Skipping setup.')
    console.log('   Run `prjct setup` manually after install.')
    return false
  }

  try {
    const setup = require(setupPath)
    await setup.run()
    return true
  } catch (error) {
    console.warn('   Setup warning:', error.message)
    console.log('   Run `prjct setup` manually after install.')
    return false
  }
}

/**
 * Run setup using bun (for bun users - faster)
 */
async function runSetupBun() {
  const setupPath = path.join(ROOT, 'core', 'infrastructure', 'setup.ts')

  try {
    execSync(`bun ${setupPath}`, { cwd: ROOT, stdio: 'inherit' })
    return true
  } catch (error) {
    // Fallback to compiled version
    return runSetupCompiled()
  }
}

/**
 * Update statusline version in existing scripts
 */
function updateStatusLineVersion() {
  try {
    const homeDir = process.env.HOME || require('os').homedir()
    const packageJson = require(path.join(ROOT, 'package.json'))
    const version = packageJson.version

    const statusLinePaths = [
      path.join(homeDir, '.prjct-cli', 'statusline', 'statusline.sh'),
      path.join(homeDir, '.claude', 'prjct-statusline.sh'),
    ]

    for (const statusLinePath of statusLinePaths) {
      if (fs.existsSync(statusLinePath)) {
        const stats = fs.lstatSync(statusLinePath)
        const actualPath = stats.isSymbolicLink()
          ? fs.readlinkSync(statusLinePath)
          : statusLinePath

        if (fs.existsSync(actualPath)) {
          let content = fs.readFileSync(actualPath, 'utf8')
          if (content.includes('CLI_VERSION=')) {
            const updated = content.replace(/CLI_VERSION="[^"]*"/, `CLI_VERSION="${version}"`)
            fs.writeFileSync(actualPath, updated, { mode: 0o755 })
            return true
          }
        }
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Main
 */
async function main() {
  // ALWAYS run setup - don't try to detect global vs local
  // Worst case: setup runs unnecessarily on local dev installs (harmless)
  // Best case: setup actually works for all users

  console.log('')
  console.log('   prjct-cli postinstall')
  console.log('')

  // Update statusline version first (fast, always works)
  if (updateStatusLineVersion()) {
    console.log('   ✓ Statusline version updated')
  }

  // Run full setup
  let success = false
  if (hasBun()) {
    success = await runSetupBun()
  } else {
    success = await runSetupCompiled()
  }

  if (!success) {
    console.log('   ⚠ Setup incomplete. Run: npx prjct-cli setup')
  }

  console.log('')
}

main().catch((error) => {
  // Log error but don't fail npm install
  console.error('   postinstall error:', error.message)
  console.log('   Run manually: npx prjct-cli setup')
  process.exit(0)
})
