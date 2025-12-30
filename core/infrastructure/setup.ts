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
import fs from 'fs'
import path from 'path'
import os from 'os'
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

    // Step 4c: Install status line with version check
    await installStatusLine()
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
 * Install status line script with version check
 */
async function installStatusLine(): Promise<void> {
  try {
    const claudeDir = path.join(os.homedir(), '.claude')
    const settingsPath = path.join(claudeDir, 'settings.json')
    const statusLinePath = path.join(claudeDir, 'prjct-statusline.sh')

    // Ensure .claude directory exists
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true })
    }

    // Version is embedded at install time
    const scriptContent = `#!/bin/bash
# prjct Status Line for Claude Code
# Shows version update notifications and current task

# Current CLI version (embedded at install time)
CLI_VERSION="${VERSION}"

# Read JSON context from stdin (provided by Claude Code)
read -r json

# Extract cwd from JSON
CWD=$(echo "$json" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"cwd"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')

# Check if this is a prjct project
CONFIG="$CWD/.prjct/prjct.config.json"
if [[ -f "$CONFIG" ]]; then
  # Extract projectId
  PROJECT_ID=$(grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG" | sed 's/.*"projectId"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')

  if [[ -n "$PROJECT_ID" ]]; then
    PROJECT_JSON="$HOME/.prjct-cli/projects/$PROJECT_ID/project.json"

    # Check version mismatch
    if [[ -f "$PROJECT_JSON" ]]; then
      PROJECT_VERSION=$(grep -o '"cliVersion"[[:space:]]*:[[:space:]]*"[^"]*"' "$PROJECT_JSON" | sed 's/.*"cliVersion"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')

      # If no cliVersion or different version, show update notice
      if [[ -z "$PROJECT_VERSION" ]] || [[ "$PROJECT_VERSION" != "$CLI_VERSION" ]]; then
        echo "⚠️ prjct v$CLI_VERSION available! Run /p:sync"
        exit 0
      fi
    else
      # No project.json means project needs sync
      echo "⚠️ prjct v$CLI_VERSION available! Run /p:sync"
      exit 0
    fi

    # Show current task if exists
    STATE="$HOME/.prjct-cli/projects/$PROJECT_ID/storage/state.json"
    if [[ -f "$STATE" ]]; then
      TASK=$(grep -o '"description"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATE" | head -1 | sed 's/.*"description"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')
      STATUS=$(grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATE" | head -1 | sed 's/.*"status"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')

      if [[ -n "$TASK" ]] && [[ "$STATUS" == "active" ]]; then
        # Truncate task to 40 chars
        TASK_SHORT="\${TASK:0:40}"
        [[ \${#TASK} -gt 40 ]] && TASK_SHORT="$TASK_SHORT..."
        echo "🎯 $TASK_SHORT"
        exit 0
      fi
    fi
  fi
fi

# Default: show prjct branding
echo "⚡ prjct"
`
    fs.writeFileSync(statusLinePath, scriptContent, { mode: 0o755 })

    // Update settings.json to use this status line
    let settings: Record<string, unknown> = {}
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
      } catch {
        // Invalid JSON, start fresh
      }
    }

    settings.statusLine = {
      type: 'command',
      command: statusLinePath
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  } catch {
    // Silently fail - status line is optional
  }
}

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
