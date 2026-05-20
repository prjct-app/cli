#!/usr/bin/env node

/**
 * postinstall - Minimal setup message
 *
 * NOTE: postinstall often doesn't run (npm quirks, --ignore-scripts, etc.)
 * The reliable setup path is `prjct start` which users run manually.
 *
 * This script may repair required native dependencies, but it must never
 * install optional tools, mutate shell config, or configure integrations.
 */

const fs = require('node:fs')
const path = require('node:path')
const { ensureNativeDependencies } = require('./ensure-native-deps')

const ROOT = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
const VERSION = pkg.version

// Colors
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

try {
  const result = ensureNativeDependencies({ stdio: 'inherit' })
  if (result.rebuilt) {
    console.log(`   ${DIM}Built required SQLite native dependency.${RESET}`)
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`\n${BOLD}prjct native dependency repair warning:${RESET} ${message}`)
  console.error(
    `${DIM}Install will continue. prjct will retry this repair before starting the daemon.${RESET}`
  )
}

console.log(`
${CYAN}${BOLD}   prjct${RESET} ${DIM}v${VERSION}${RESET}

   ${GREEN}✓${RESET} Installed successfully!

   ${BOLD}Next step:${RESET} Run ${CYAN}prjct start${RESET} to configure your AI providers.

   ${DIM}Supports: Claude Code, Gemini CLI, or both${RESET}
`)
