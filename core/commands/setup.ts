/**
 * Setup Commands: start, setup, installStatusLine, showAsciiArt
 */

import path from 'path'
import fs from 'fs'
import os from 'os'
import chalk from 'chalk'

import commandInstaller from '../infrastructure/command-installer'
import type { CommandResult, SetupOptions, MigrateOptions } from '../types'
import { PrjctCommandsBase } from './base'
import { VERSION } from '../utils/version'

export class SetupCommands extends PrjctCommandsBase {
  /**
   * First-time setup - Install commands to editors
   */
  async start(): Promise<CommandResult> {
    console.log('🚀 Setting up prjct for Claude...\n')

    const status = await commandInstaller.checkInstallation()

    if (!status.claudeDetected) {
      return {
        success: false,
        message:
          '❌ Claude not detected.\n\nPlease install Claude Code or Claude Desktop first:\n' +
          '  - Claude Code: https://claude.com/code\n' +
          '  - Claude Desktop: https://claude.com/desktop',
      }
    }

    console.log('📦 Installing /p:* commands...')
    const result = await commandInstaller.installCommands()

    if (!result.success) {
      return {
        success: false,
        message: `❌ Installation failed: ${result.error}`,
      }
    }

    console.log(`\n✅ Installed ${result.installed?.length ?? 0} commands to:\n   ${result.path}`)

    if ((result.errors?.length ?? 0) > 0) {
      console.log(`\n⚠️  ${result.errors?.length ?? 0} errors:`)
      result.errors?.forEach((e: { file: string; error: string }) => console.log(`   - ${e.file}: ${e.error}`))
    }

    console.log('\n🎉 Setup complete!')
    console.log('\nNext steps:')
    console.log('  1. Open Claude Code or Claude Desktop')
    console.log('  2. Navigate to your project')
    console.log('  3. Run: /p:init')

    return {
      success: true,
      message: '',
    }
  }

  /**
   * Reconfigure editor installations
   */
  async setup(options: SetupOptions = {}): Promise<CommandResult> {
    console.log('🔧 Reconfiguring prjct...\n')

    if (options.force) {
      console.log('🗑️  Removing existing installation...')
      await commandInstaller.uninstallCommands()
    }

    console.log('📦 Installing /p:* commands...')
    const result = await commandInstaller.updateCommands()

    if (!result.success) {
      return {
        success: false,
        message: `❌ Setup failed: ${result.error}`,
      }
    }

    console.log(`\n✅ Installed ${result.installed?.length ?? 0} commands`)

    if ((result.errors?.length ?? 0) > 0) {
      console.log(`\n⚠️  ${result.errors?.length ?? 0} errors:`)
      result.errors?.forEach((e: { file: string; error: string }) => console.log(`   - ${e.file}: ${e.error}`))
    }

    console.log('\n📝 Installing global configuration...')
    const configResult = await commandInstaller.installGlobalConfig()

    if (configResult.success) {
      if (configResult.action === 'created') {
        console.log('✅ Created ~/.claude/CLAUDE.md')
      } else if (configResult.action === 'updated') {
        console.log('✅ Updated ~/.claude/CLAUDE.md')
      } else if (configResult.action === 'appended') {
        console.log('✅ Added prjct config to ~/.claude/CLAUDE.md')
      }
    } else {
      console.log(`⚠️  ${configResult.error}`)
    }

    console.log('\n⚡ Installing status line...')
    const statusLineResult = await this.installStatusLine()
    if (statusLineResult.success) {
      console.log('✅ Status line configured')
    } else {
      console.log(`⚠️  ${statusLineResult.error}`)
    }

    console.log('\n🎉 Setup complete!\n')

    this.showAsciiArt()

    return {
      success: true,
      message: '',
    }
  }

  /**
   * Install status line script and configure settings.json
   */
  async installStatusLine(): Promise<{ success: boolean; error?: string }> {
    try {
      const claudeDir = path.join(os.homedir(), '.claude')
      const settingsPath = path.join(claudeDir, 'settings.json')
      const statusLinePath = path.join(claudeDir, 'prjct-statusline.sh')

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

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Show beautiful ASCII art with quick start
   */
  showAsciiArt(): void {
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log('')
    console.log(chalk.bold.cyan('   ██████╗ ██████╗      ██╗ ██████╗████████╗'))
    console.log(chalk.bold.cyan('   ██╔══██╗██╔══██╗     ██║██╔════╝╚══██╔══╝'))
    console.log(chalk.bold.cyan('   ██████╔╝██████╔╝     ██║██║        ██║'))
    console.log(chalk.bold.cyan('   ██╔═══╝ ██╔══██╗██   ██║██║        ██║'))
    console.log(chalk.bold.cyan('   ██║     ██║  ██║╚█████╔╝╚██████╗   ██║'))
    console.log(chalk.bold.cyan('   ╚═╝     ╚═╝  ╚═╝ ╚════╝  ╚═════╝   ╚═╝'))
    console.log('')
    console.log(`   ${chalk.bold.cyan('prjct')}${chalk.magenta('/')}${chalk.green('cli')}  ${chalk.dim.white('v' + VERSION + ' installed')}`)
    console.log('')
    console.log(`   ${chalk.yellow('⚡')} Ship faster with zero friction`)
    console.log(`   ${chalk.green('📝')} From idea to technical tasks in minutes`)
    console.log(`   ${chalk.cyan('🤖')} Perfect context for AI agents`)
    console.log('')
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log('')
    console.log(chalk.bold.cyan('🚀 Quick Start'))
    console.log(chalk.dim('─────────────────────────────────────────────────'))
    console.log('')
    console.log(`  ${chalk.bold('1.')} Initialize your project:`)
    console.log(`     ${chalk.green('cd your-project && prjct init')}`)
    console.log('')
    console.log(`  ${chalk.bold('2.')} Start your first task:`)
    console.log(`     ${chalk.green('prjct task "build auth"')}`)
    console.log('')
    console.log(`  ${chalk.bold('3.')} Ship & celebrate:`)
    console.log(`     ${chalk.green('prjct ship "user login"')}`)
    console.log('')
    console.log(chalk.dim('─────────────────────────────────────────────────'))
    console.log('')
    console.log(`  ${chalk.dim('Documentation:')} ${chalk.cyan('https://prjct.app')}`)
    console.log(`  ${chalk.dim('Report issues:')} ${chalk.cyan('https://github.com/jlopezlira/prjct-cli/issues')}`)
    console.log('')
    console.log(chalk.bold.magenta('Happy shipping! 🚀'))
    console.log('')
  }

  /**
   * Migrate all projects to UUID format
   */
  async migrateAll(_options: MigrateOptions = {}): Promise<CommandResult> {
    console.log('🔄 Migrating all projects to UUID format...\n')

    // TODO: Implement full migration logic
    // For now, return success as this is a stub
    console.log('✅ Migration complete (no projects needed migration)\n')

    return {
      success: true,
      message: 'Migration complete',
    }
  }

}
