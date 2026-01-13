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
import { VERSION, getPackageRoot } from '../utils/version'
import { isNotFoundError } from '../types/fs'

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
  } catch (_error) {
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

  // Step 6: Migrate existing projects to add cliVersion
  await migrateProjectsCliVersion()

  // Show results
  showResults(results)

  return results
}

// Default export for CommonJS require
export default { run }

/**
 * Migrate existing projects to add cliVersion field
 * This clears the status line warning after npm update
 */
async function migrateProjectsCliVersion(): Promise<void> {
  try {
    const projectsDir = path.join(os.homedir(), '.prjct-cli', 'projects')

    if (!fs.existsSync(projectsDir)) {
      return
    }

    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

    let migrated = 0

    for (const projectId of projectDirs) {
      const projectJsonPath = path.join(projectsDir, projectId, 'project.json')

      if (!fs.existsSync(projectJsonPath)) {
        continue
      }

      try {
        const content = fs.readFileSync(projectJsonPath, 'utf8')
        const project = JSON.parse(content)

        // Only update if cliVersion is missing or different
        if (project.cliVersion !== VERSION) {
          project.cliVersion = VERSION
          fs.writeFileSync(projectJsonPath, JSON.stringify(project, null, 2))
          migrated++
        }
      } catch (error) {
        // Skip invalid project.json files (missing or malformed JSON)
        if (!isNotFoundError(error) && !(error instanceof SyntaxError)) {
          throw error
        }
      }
    }

    if (migrated > 0) {
      console.log(`   ${GREEN}✓${NC} Updated ${migrated} project(s) to v${VERSION}`)
    }
  } catch (error) {
    // Silently fail if projects directory doesn't exist
    if (!isNotFoundError(error)) {
      // Log unexpected errors but don't crash - migration is optional
      console.error(`Migration warning: ${(error as Error).message}`)
    }
  }
}

/**
 * Ensure settings.json has statusLine configured
 */
function ensureStatusLineSettings(settingsPath: string, statusLinePath: string): void {
  let settings: Record<string, unknown> = {}
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    } catch (error) {
      // Invalid JSON, start fresh - but propagate unexpected errors
      if (!(error instanceof SyntaxError)) {
        throw error
      }
    }
  }
  settings.statusLine = { type: 'command', command: statusLinePath }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}

/**
 * Install status line script with version check
 * Copies modular statusline from assets/ to ~/.prjct-cli/statusline/
 * Includes: statusline.sh, lib/, components/, themes/, config.json
 * Creates symlink at ~/.claude/prjct-statusline.sh
 * Updates CLI_VERSION in the script
 */
async function installStatusLine(): Promise<void> {
  try {
    const claudeDir = path.join(os.homedir(), '.claude')
    const settingsPath = path.join(claudeDir, 'settings.json')
    const claudeStatusLinePath = path.join(claudeDir, 'prjct-statusline.sh')

    // Target location for the actual script
    const prjctStatusLineDir = path.join(os.homedir(), '.prjct-cli', 'statusline')
    const prjctStatusLinePath = path.join(prjctStatusLineDir, 'statusline.sh')
    const prjctThemesDir = path.join(prjctStatusLineDir, 'themes')
    const prjctLibDir = path.join(prjctStatusLineDir, 'lib')
    const prjctComponentsDir = path.join(prjctStatusLineDir, 'components')
    const prjctConfigPath = path.join(prjctStatusLineDir, 'config.json')

    // Source assets (from the package)
    const assetsDir = path.join(getPackageRoot(), 'assets', 'statusline')
    const sourceScript = path.join(assetsDir, 'statusline.sh')
    const sourceThemeDir = path.join(assetsDir, 'themes')
    const sourceLibDir = path.join(assetsDir, 'lib')
    const sourceComponentsDir = path.join(assetsDir, 'components')
    const sourceConfigPath = path.join(assetsDir, 'default-config.json')

    // Ensure directories exist
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true })
    }
    if (!fs.existsSync(prjctStatusLineDir)) {
      fs.mkdirSync(prjctStatusLineDir, { recursive: true })
    }
    if (!fs.existsSync(prjctThemesDir)) {
      fs.mkdirSync(prjctThemesDir, { recursive: true })
    }
    if (!fs.existsSync(prjctLibDir)) {
      fs.mkdirSync(prjctLibDir, { recursive: true })
    }
    if (!fs.existsSync(prjctComponentsDir)) {
      fs.mkdirSync(prjctComponentsDir, { recursive: true })
    }

    // Check if statusline already exists
    if (fs.existsSync(prjctStatusLinePath)) {
      const existingContent = fs.readFileSync(prjctStatusLinePath, 'utf8')

      if (existingContent.includes('CLI_VERSION=')) {
        // Has CLI_VERSION - update if needed
        const versionMatch = existingContent.match(/CLI_VERSION="([^"]*)"/)

        if (versionMatch && versionMatch[1] !== VERSION) {
          // Update CLI_VERSION in-place
          const updatedContent = existingContent.replace(
            /CLI_VERSION="[^"]*"/,
            `CLI_VERSION="${VERSION}"`
          )
          fs.writeFileSync(prjctStatusLinePath, updatedContent, { mode: 0o755 })
        }

        // Ensure modular structure is installed (upgrade path)
        installStatusLineModules(sourceLibDir, prjctLibDir)
        installStatusLineModules(sourceComponentsDir, prjctComponentsDir)

        // Ensure symlink and settings
        ensureStatusLineSymlink(claudeStatusLinePath, prjctStatusLinePath)
        ensureStatusLineSettings(settingsPath, claudeStatusLinePath)
        return
      }
      // else: Script exists WITHOUT CLI_VERSION - fall through to replace with new version
    }

    // Install fresh from assets if source exists
    if (fs.existsSync(sourceScript)) {
      // Copy script and update version
      let scriptContent = fs.readFileSync(sourceScript, 'utf8')
      scriptContent = scriptContent.replace(
        /CLI_VERSION="[^"]*"/,
        `CLI_VERSION="${VERSION}"`
      )
      fs.writeFileSync(prjctStatusLinePath, scriptContent, { mode: 0o755 })

      // Copy lib/ modules
      installStatusLineModules(sourceLibDir, prjctLibDir)

      // Copy components/
      installStatusLineModules(sourceComponentsDir, prjctComponentsDir)

      // Copy themes
      if (fs.existsSync(sourceThemeDir)) {
        const themes = fs.readdirSync(sourceThemeDir)
        for (const theme of themes) {
          const src = path.join(sourceThemeDir, theme)
          const dest = path.join(prjctThemesDir, theme)
          // Always update themes to get new icons/colors
          fs.copyFileSync(src, dest)
        }
      }

      // Copy default config (only if not exists - preserve user customizations)
      if (!fs.existsSync(prjctConfigPath) && fs.existsSync(sourceConfigPath)) {
        fs.copyFileSync(sourceConfigPath, prjctConfigPath)
      }
    } else {
      // Fallback: create simple script inline
      const scriptContent = `#!/bin/bash
# prjct Status Line for Claude Code
CLI_VERSION="${VERSION}"
input=$(cat)
CWD=$(echo "$input" | jq -r '.workspace.current_dir // "~"' 2>/dev/null)
CONFIG="$CWD/.prjct/prjct.config.json"
if [ -f "$CONFIG" ]; then
  PROJECT_ID=$(jq -r '.projectId // ""' "$CONFIG" 2>/dev/null)
  if [ -n "$PROJECT_ID" ]; then
    PROJECT_JSON="$HOME/.prjct-cli/projects/$PROJECT_ID/project.json"
    if [ -f "$PROJECT_JSON" ]; then
      PROJECT_VERSION=$(jq -r '.cliVersion // ""' "$PROJECT_JSON" 2>/dev/null)
      if [ -z "$PROJECT_VERSION" ] || [ "$PROJECT_VERSION" != "$CLI_VERSION" ]; then
        echo "prjct v$CLI_VERSION - run p. sync"
        exit 0
      fi
    else
      echo "prjct v$CLI_VERSION - run p. sync"
      exit 0
    fi
    STATE="$HOME/.prjct-cli/projects/$PROJECT_ID/storage/state.json"
    if [ -f "$STATE" ]; then
      TASK=$(jq -r '.currentTask.description // ""' "$STATE" 2>/dev/null)
      if [ -n "$TASK" ]; then
        echo "$TASK"
        exit 0
      fi
    fi
  fi
fi
echo "prjct"
`
      fs.writeFileSync(prjctStatusLinePath, scriptContent, { mode: 0o755 })
    }

    // Create symlink and configure settings
    ensureStatusLineSymlink(claudeStatusLinePath, prjctStatusLinePath)
    ensureStatusLineSettings(settingsPath, claudeStatusLinePath)
  } catch (error) {
    // Silently fail if directories don't exist
    if (!isNotFoundError(error)) {
      // Log unexpected errors but don't crash - status line is optional
      console.error(`Status line warning: ${(error as Error).message}`)
    }
  }
}

/**
 * Install statusline modules (lib/ or components/)
 * Copies .sh files from source to destination, always overwriting for updates
 */
function installStatusLineModules(sourceDir: string, destDir: string): void {
  if (!fs.existsSync(sourceDir)) {
    return
  }

  const files = fs.readdirSync(sourceDir)
  for (const file of files) {
    if (file.endsWith('.sh')) {
      const src = path.join(sourceDir, file)
      const dest = path.join(destDir, file)
      fs.copyFileSync(src, dest)
      fs.chmodSync(dest, 0o755)
    }
  }
}

/**
 * Ensure symlink from Claude config to prjct statusline
 */
function ensureStatusLineSymlink(linkPath: string, targetPath: string): void {
  try {
    // Check if link already points to correct target
    if (fs.existsSync(linkPath)) {
      const stats = fs.lstatSync(linkPath)
      if (stats.isSymbolicLink()) {
        const existingTarget = fs.readlinkSync(linkPath)
        if (existingTarget === targetPath) {
          return // Already correct
        }
      }
      // Remove existing file/symlink
      fs.unlinkSync(linkPath)
    }
    // Create symlink
    fs.symlinkSync(targetPath, linkPath)
  } catch (error) {
    // If symlink fails (e.g., Windows, permission issues), try copy instead
    try {
      if (fs.existsSync(targetPath)) {
        fs.copyFileSync(targetPath, linkPath)
        fs.chmodSync(linkPath, 0o755)
      }
    } catch (copyError) {
      // Both symlink and copy failed - log if unexpected error
      if (!isNotFoundError(copyError)) {
        console.error(`Symlink fallback warning: ${(copyError as Error).message}`)
      }
    }
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

// Auto-execute when run directly (for bun/node CLI usage)
// This enables: bun core/infrastructure/setup.ts
const isDirectRun = process.argv[1]?.includes('setup.ts') || process.argv[1]?.includes('setup.js')
if (isDirectRun) {
  run().catch((error) => {
    console.error('Setup error:', error.message)
    process.exit(1)
  })
}
