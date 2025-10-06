const { execSync } = require('child_process')
const installer = require('./command-installer')
const migrator = require('./migrator')
const editorsConfig = require('./editors-config')
const { VERSION } = require('../utils/version')

/**
 * Setup Module - Core installation logic
 *
 * Ejecuta TODO el setup necesario para prjct-cli:
 * 1. Instalar Claude Code CLI si falta
 * 2. Sincronizar comandos a ~/.claude/commands/p/
 * 3. Instalar configuración global ~/.claude/CLAUDE.md
 * 4. Migrar proyectos legacy automáticamente
 * 5. Guardar versión en editors-config
 *
 * Este módulo es llamado desde:
 * - core/index.js (en primer uso del CLI)
 * - scripts/postinstall.js (si npm scripts están habilitados)
 *
 * @version 0.8.5
 */

// Colors
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const NC = '\x1b[0m'

/**
 * Check if Claude Code CLI is installed
 */
async function hasClaudeCodeCLI() {
  try {
    execSync('which claude', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Install Claude Code CLI
 */
async function installClaudeCode() {
  try {
    console.log(`${YELLOW}📦 Claude Code not found. Installing...${NC}`)
    console.log('')
    execSync('npm install -g @anthropic-ai/claude-code', { stdio: 'inherit' })
    console.log('')
    console.log(`${GREEN}✓${NC} Claude Code installed successfully`)
    console.log('')
    return true
  } catch (error) {
    console.log(`${YELLOW}⚠️  Failed to install Claude Code: ${error.message}${NC}`)
    console.log(`${DIM}Please install manually: npm install -g @anthropic-ai/claude-code${NC}`)
    console.log('')
    return false
  }
}

/**
 * Main setup function
 */
async function run() {
  const results = {
    claudeInstalled: false,
    commandsAdded: 0,
    commandsUpdated: 0,
    configAction: null,
    projectsMigrated: 0
  }

  // Step 1: Ensure Claude Code CLI is installed
  const hasClaude = await hasClaudeCodeCLI()

  if (!hasClaude) {
    const installed = await installClaudeCode()
    if (installed) {
      results.claudeInstalled = true
    } else {
      throw new Error('Claude Code installation failed')
    }
  }

  // Step 2: Detect Claude directory (for commands)
  const claudeDetected = await installer.detectClaude()

  if (claudeDetected) {
    // Step 3: Sync commands
    const syncResult = await installer.syncCommands()

    if (syncResult.success) {
      results.commandsAdded = syncResult.added
      results.commandsUpdated = syncResult.updated
    }

    // Step 4: Install global configuration
    const configResult = await installer.installGlobalConfig()

    if (configResult.success) {
      results.configAction = configResult.action
    }

    // Step 5: Migrate legacy projects automatically
    const migrationResult = await migrator.migrateAll({
      deepScan: false,
      cleanupLegacy: true,
      dryRun: false
    })

    if (migrationResult.successfullyMigrated > 0) {
      results.projectsMigrated = migrationResult.successfullyMigrated
    }
  }

  // Step 6: Save version in editors-config
  await editorsConfig.saveConfig(VERSION, installer.getInstallPath())

  // Show results
  showResults(results)

  return results
}

/**
 * Show setup results
 */
function showResults(results) {
  console.log('')

  // Show what was done
  if (results.claudeInstalled) {
    console.log(`   ${GREEN}✓${NC} Claude Code CLI installed`)
  } else {
    console.log(`   ${GREEN}✓${NC} Claude Code CLI found`)
  }

  const totalCommands = results.commandsAdded + results.commandsUpdated
  if (totalCommands > 0) {
    const parts = []
    if (results.commandsAdded > 0) parts.push(`${results.commandsAdded} new`)
    if (results.commandsUpdated > 0) parts.push(`${results.commandsUpdated} updated`)
    console.log(`   ${GREEN}✓${NC} Commands synced (${parts.join(', ')})`)
  } else {
    console.log(`   ${GREEN}✓${NC} Commands up to date`)
  }

  if (results.configAction === 'created') {
    console.log(`   ${GREEN}✓${NC} Global config created`)
  } else if (results.configAction === 'updated') {
    console.log(`   ${GREEN}✓${NC} Global config updated`)
  } else if (results.configAction === 'appended') {
    console.log(`   ${GREEN}✓${NC} Global config merged`)
  }

  if (results.projectsMigrated > 0) {
    console.log(`   ${GREEN}✓${NC} ${results.projectsMigrated} projects migrated to global storage`)
  }

  console.log('')
}

module.exports = { run }
