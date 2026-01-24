#!/usr/bin/env node

/**
 * postinstall - Minimal setup message
 *
 * NOTE: postinstall often doesn't run (npm quirks, --ignore-scripts, etc.)
 * The reliable setup path is `prjct start` which users run manually.
 *
 * This script just shows a helpful message.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
const VERSION = pkg.version

// Colors
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

console.log(`
${CYAN}${BOLD}   prjct${RESET} ${DIM}v${VERSION}${RESET}

   ${GREEN}✓${RESET} Installed successfully!

   ${BOLD}Next step:${RESET} Run ${CYAN}prjct start${RESET} to configure your AI providers.

   ${DIM}Supports: Claude Code, Gemini CLI, or both${RESET}
`)
