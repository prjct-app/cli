/**
 * Setup Module - Core installation logic
 *
 * Executes ALL setup needed for prjct-cli:
 * 1. Install Claude Code CLI if missing
 * 2. Sync commands to ~/.claude/commands/p/
 * 3. Install global config ~/.claude/CLAUDE.md
 * 4. Save version in editors-config
 *
 * This module is called from:
 * - core/index.js (on first CLI use)
 * - scripts/postinstall.js (if npm scripts are enabled)
 */

import { execSync } from 'child_process'
import installer from './command-installer'
import editorsConfig from './editors-config'
import { VERSION } from '../utils/version'

// Colors
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const NC = '\x1b[0m'

interface SetupResults {
  claudeInstalled: boolean
  commandsAdded: number
  commandsUpdated: number
  configAction: string | null
}

/**
 * Check if Claude Code CLI is installed
 */
async function hasClaudeCodeCLI(): Promise<boolean> {
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
async function installClaudeCode(): Promise<boolean> {
  try {
    console.log(`${YELLOW}📦 Claude Code not found. Installing...${NC}`)
    console.log('')
    execSync('npm install -g @anthropic-ai/claude-code', { stdio: 'inherit' })
    console.log('')
    console.log(`${GREEN}✓${NC} Claude Code installed successfully`)
    console.log('')
    return true
  } catch (error) {
    console.log(`${YELLOW}⚠️  Failed to install Claude Code: ${(error as Error).message}${NC}`)
    console.log(`${DIM}Please install manually: npm install -g @anthropic-ai/claude-code${NC}`)
    console.log('')
    return false
  }
}

/**
 * Main setup function
 */
export async function run(): Promise<SetupResults> {
  const results: SetupResults = {
    claudeInstalled: false,
    commandsAdded: 0,
    commandsUpdated: 0,
    configAction: null,
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

    // Step 4b: Install documentation files
    await installer.installDocs()
  }

  // Step 5: Save version in editors-config
  await editorsConfig.saveConfig(VERSION, installer.getInstallPath())

  // Show results
  showResults(results)

  return results
}

// Default export for CommonJS require
export default { run }

/**
 * Show setup results
 */
function showResults(results: SetupResults): void {
  console.log('')

  if (results.claudeInstalled) {
    console.log(`   ${GREEN}✓${NC} Claude Code CLI installed`)
  } else {
    console.log(`   ${GREEN}✓${NC} Claude Code CLI found`)
  }

  const totalCommands = results.commandsAdded + results.commandsUpdated
  if (totalCommands > 0) {
    const parts: string[] = []
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

  console.log('')
}
