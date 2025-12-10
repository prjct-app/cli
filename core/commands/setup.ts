/**
 * Setup Commands: start, setup, migrateAll, installStatusLine, showAsciiArt
 */

import path from 'path'
import fs from 'fs'
import os from 'os'

import migrator from '../infrastructure/migrator'
import type { CommandResult, SetupOptions, MigrateOptions, GlobalConfig, MigrationResult } from './types'
import {
  PrjctCommandsBase,
  configManager,
  dateHelper
} from './base'
import { VERSION } from '../utils/version'

export class SetupCommands extends PrjctCommandsBase {
  /**
   * First-time setup - Install commands to editors
   */
  async start(): Promise<CommandResult> {
    const commandInstaller = require('../infrastructure/command-installer')

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

    console.log(`\n✅ Installed ${result.installed.length} commands to:\n   ${result.path}`)

    if (result.errors.length > 0) {
      console.log(`\n⚠️  ${result.errors.length} errors:`)
      result.errors.forEach((e: { file: string; error: string }) => console.log(`   - ${e.file}: ${e.error}`))
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
    const commandInstaller = require('../infrastructure/command-installer')

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

    console.log(`\n✅ Installed ${result.installed.length} commands`)

    if (result.errors.length > 0) {
      console.log(`\n⚠️  ${result.errors.length} errors:`)
      result.errors.forEach((e: { file: string; error: string }) => console.log(`   - ${e.file}: ${e.error}`))
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

      const scriptContent = `#!/bin/bash
# prjct Status Line for Claude Code
# Shows ⚡ prjct with animated spinner when command is running

# Read JSON context from stdin (provided by Claude Code)
read -r json

# Spinner frames
frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

# Calculate frame based on time (changes every 80ms)
frame=$(($(date +%s%N 2>/dev/null || echo 0) / 80000000 % 10))

# Check if prjct command is running
running_file="$HOME/.prjct-cli/.running"

if [ -f "$running_file" ]; then
  task=$(cat "$running_file" 2>/dev/null || echo "working")
  echo "⚡ prjct \${frames[$frame]} $task"
else
  echo "⚡ prjct"
fi
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
    const chalk = require('chalk')

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
    console.log(`  ${chalk.bold('2.')} Set your current focus:`)
    console.log(`     ${chalk.green('prjct now "build auth"')}`)
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
   * Migrate all legacy projects
   */
  async migrateAll(options: MigrateOptions = {}): Promise<CommandResult> {
    const fsPromises = require('fs').promises

    console.log('🔄 Scanning for legacy prjct projects...\n')

    const homeDir = os.homedir()
    const globalRoot = path.join(homeDir, '.prjct-cli', 'projects')

    let projectIds: string[] = []
    try {
      const dirs = await fsPromises.readdir(globalRoot)
      projectIds = dirs.filter((d: string) => !d.startsWith('.'))
    } catch {
      return {
        success: false,
        message: '❌ No prjct projects found',
      }
    }

    console.log(`📁 Found ${projectIds.length} projects in global storage\n`)

    const migrated: { projectId: string; path: string }[] = []
    const failed: { projectId: string; path: string; error: string }[] = []
    const skipped: { projectId: string; reason: string }[] = []

    for (const projectId of projectIds) {
      const globalConfig = await configManager.readGlobalConfig(projectId) as GlobalConfig | null
      if (!globalConfig || !globalConfig.projectPath) {
        skipped.push({ projectId, reason: 'No project path in config' })
        continue
      }

      const projectPath = globalConfig.projectPath!

      if (!(await migrator.needsMigration(projectPath))) {
        skipped.push({ projectId, reason: 'Already migrated' })
        continue
      }

      console.log(`🔄 Migrating: ${projectPath}`)

      try {
        const result = await migrator.migrate(projectPath, options) as MigrationResult

        if (result.success) {
          migrated.push({ projectId, path: projectPath })
          console.log(`   ✅ Migrated successfully`)
        } else {
          const issues = result.issues?.join(', ') || 'Unknown error'
          failed.push({ projectId, path: projectPath, error: issues })
          console.log(`   ❌ ${issues}`)
        }
      } catch (error) {
        failed.push({ projectId, path: projectPath, error: (error as Error).message })
        console.log(`   ❌ ${(error as Error).message}`)
      }

      console.log('')
    }

    console.log('\n📊 Migration Summary:')
    console.log(`   ✅ Migrated: ${migrated.length}`)
    console.log(`   ⏭️  Skipped: ${skipped.length}`)
    console.log(`   ❌ Failed: ${failed.length}`)

    if (failed.length > 0) {
      console.log('\n❌ Failed migrations:')
      failed.forEach((f) => console.log(`   - ${f.path}: ${f.error}`))
    }

    return {
      success: failed.length === 0,
      message: '',
    }
  }
}
