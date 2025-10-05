#!/usr/bin/env node

/**
 * Post-install hook for prjct-cli
 *
 * Runs automatically after npm install -g prjct-cli
 *
 * 1. Detects if global install
 * 2. Installs/syncs commands to ~/.claude/commands/p/
 * 3. Installs/updates global config to ~/.claude/CLAUDE.md
 * 4. Migrates legacy projects automatically
 * 5. Shows beautiful ASCII art
 *
 * @version 0.8.2
 */

const fs = require('fs')
const path = require('path')
const installer = require('../core/infrastructure/command-installer')
const migrator = require('../core/infrastructure/migrator')
const { VERSION } = require('../core/utils/version')

// Colors for terminal output
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const MAGENTA = '\x1b[35m'
const WHITE = '\x1b[37m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const NC = '\x1b[0m' // No Color

async function main() {
  try {
    // Detect if this is a global install
    const isGlobal = await detectGlobalInstall()

    if (!isGlobal) {
      // Skip postinstall for local development installs
      console.log(`${DIM}Skipping post-install (local development)${NC}`)
      return
    }

    console.log('')
    console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`)
    console.log(`${BOLD}${CYAN}🚀 Setting up prjct-cli...${NC}`)
    console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`)
    console.log('')

    // Step 1: Detect Claude Code
    console.log(`${BOLD}[1/5]${NC} Detecting Claude Code...`)
    const claudeDetected = await installer.detectClaude()

    if (!claudeDetected) {
      console.log(`${YELLOW}⚠️  Claude Code not detected${NC}`)
      console.log(`${DIM}Install Claude Code from: https://claude.ai/code${NC}`)
      console.log(`${DIM}Then run: prjct setup${NC}`)
      console.log('')
    } else {
      console.log(`${GREEN}✓${NC} Claude Code found`)
      console.log('')

      // Step 2: Install/sync commands
      console.log(`${BOLD}[2/5]${NC} Installing commands to ~/.claude...`)
      const syncResult = await installer.syncCommands()

      if (syncResult.success) {
        const { added, updated, removed } = syncResult
        const changes = []
        if (added > 0) changes.push(`${added} nuevos`)
        if (updated > 0) changes.push(`${updated} actualizados`)
        if (removed > 0) changes.push(`${removed} eliminados`)

        if (changes.length > 0) {
          console.log(`${GREEN}✓${NC} ${changes.join(', ')}`)
        } else {
          console.log(`${GREEN}✓${NC} All commands up to date`)
        }
      } else {
        console.log(`${YELLOW}⚠️  ${syncResult.error}${NC}`)
      }
      console.log('')

      // Step 3: Install global configuration
      console.log(`${BOLD}[3/5]${NC} Installing global configuration...`)
      const configResult = await installer.installGlobalConfig()

      if (configResult.success) {
        if (configResult.action === 'created') {
          console.log(`${GREEN}✓${NC} Created ~/.claude/CLAUDE.md`)
        } else if (configResult.action === 'updated') {
          console.log(`${GREEN}✓${NC} Updated ~/.claude/CLAUDE.md`)
        } else if (configResult.action === 'appended') {
          console.log(`${GREEN}✓${NC} Added prjct config to ~/.claude/CLAUDE.md`)
        }
      } else {
        console.log(`${YELLOW}⚠️  ${configResult.error}${NC}`)
      }
      console.log('')
    }

    // Step 4: Migrate legacy projects
    console.log(`${BOLD}[4/5]${NC} Checking for legacy projects...`)
    const migrationResult = await migrator.migrateAll({
      deepScan: false,      // Only search common directories
      cleanupLegacy: true,  // Remove legacy directories, keep config
      dryRun: false
    })

    if (migrationResult.successfullyMigrated > 0) {
      console.log(`${GREEN}✓${NC} ${migrationResult.successfullyMigrated} projects migrated to global storage`)
    } else if (migrationResult.totalFound === 0) {
      console.log(`${DIM}No legacy projects found${NC}`)
    } else {
      console.log(`${DIM}All projects already migrated${NC}`)
    }
    console.log('')

    // Step 5: Show ASCII art and quick start
    console.log(`${BOLD}[5/5]${NC} Installation complete!`)
    console.log('')
    showAsciiArt()

  } catch (error) {
    console.error(`${YELLOW}⚠️  Post-install error: ${error.message}${NC}`)
    console.error(`${DIM}You can run 'prjct setup' manually later${NC}`)
    // Don't fail the install if post-install has issues
    process.exit(0)
  }
}

/**
 * Detect if this is a global npm install
 */
async function detectGlobalInstall() {
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

/**
 * Show beautiful ASCII art with quick start
 */
function showAsciiArt() {
  console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`)
  console.log('')
  console.log(`   ${BOLD}${CYAN}██████╗ ██████╗      ██╗ ██████╗████████╗${NC}`)
  console.log(`   ${BOLD}${CYAN}██╔══██╗██╔══██╗     ██║██╔════╝╚══██╔══╝${NC}`)
  console.log(`   ${BOLD}${CYAN}██████╔╝██████╔╝     ██║██║        ██║${NC}`)
  console.log(`   ${BOLD}${CYAN}██╔═══╝ ██╔══██╗██   ██║██║        ██║${NC}`)
  console.log(`   ${BOLD}${CYAN}██║     ██║  ██║╚█████╔╝╚██████╗   ██║${NC}`)
  console.log(`   ${BOLD}${CYAN}╚═╝     ╚═╝  ╚═╝ ╚════╝  ╚═════╝   ╚═╝${NC}`)
  console.log('')
  console.log(`   ${BOLD}${CYAN}prjct${NC}${MAGENTA}/${NC}${GREEN}cli${NC}  ${DIM}${WHITE}v${VERSION} installed${NC}`)
  console.log('')
  console.log(`   ${YELLOW}⚡${NC} Ship faster with zero friction`)
  console.log(`   ${GREEN}📝${NC} From idea to technical tasks in minutes`)
  console.log(`   ${CYAN}🤖${NC} Perfect context for AI agents`)
  console.log('')
  console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`)
  console.log('')
  console.log(`${BOLD}${CYAN}🚀 Quick Start${NC}`)
  console.log(`${DIM}─────────────────────────────────────────────────${NC}`)
  console.log('')
  console.log(`  ${BOLD}1.${NC} Initialize your project:`)
  console.log(`     ${GREEN}cd your-project && prjct init${NC}`)
  console.log('')
  console.log(`  ${BOLD}2.${NC} Set your current focus:`)
  console.log(`     ${GREEN}prjct now "build auth"${NC}`)
  console.log('')
  console.log(`  ${BOLD}3.${NC} Ship & celebrate:`)
  console.log(`     ${GREEN}prjct ship "user login"${NC}`)
  console.log('')
  console.log(`${DIM}─────────────────────────────────────────────────${NC}`)
  console.log('')
  console.log(`  ${DIM}Documentation:${NC} ${CYAN}https://prjct.app${NC}`)
  console.log(`  ${DIM}Report issues:${NC} ${CYAN}https://github.com/jlopezlira/prjct-cli/issues${NC}`)
  console.log('')
  console.log(`${BOLD}${MAGENTA}Happy shipping! 🚀${NC}`)
  console.log('')
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message)
    process.exit(0) // Don't fail npm install
  })
}

module.exports = main
