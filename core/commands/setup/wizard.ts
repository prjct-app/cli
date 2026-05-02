/**
 * High-level setup wizards: first-time `start()` and the `setup()`
 * reconfigure flow. Both compose the lower-level installers
 * (commands, MCP servers, status line, Codex skill) — they shouldn't
 * own implementation details, just orchestration.
 */

import chalk from 'chalk'
import commandInstaller from '../../infrastructure/command-installer'
import pathManager from '../../infrastructure/path-manager'
import type { CommandResult, SetupOptions } from '../../types/commands'
import { getErrorMessage } from '../../types/fs'
import { VERSION } from '../../utils/version'
import { installStatusLine } from './install-status-line'
import { setupMcpServers } from './mcp'

export async function start(): Promise<CommandResult> {
  const status = await commandInstaller.checkInstallation()
  const aiProvider = require('../../infrastructure/ai-provider')
  const codexDetection = await aiProvider.detectCodex()
  const hasCliProvider = status.providerDetected
  const activeProvider = hasCliProvider ? await aiProvider.getActiveProvider() : null
  const primaryName = hasCliProvider ? activeProvider.displayName : 'OpenAI Codex'

  console.log(`🚀 Setting up prjct for ${primaryName}...\n`)

  if (!hasCliProvider && !codexDetection.installed) {
    return {
      success: false,
      message: `❌ No supported AI provider detected.\n\nPlease install one first:\n  - Claude Code: https://docs.anthropic.com/claude-code\n  - Gemini CLI: https://geminicli.com/docs\n  - OpenAI Codex: https://github.com/openai/codex`,
    }
  }

  if (hasCliProvider) {
    console.log('📦 Installing /p:* commands...')
    const result = await commandInstaller.installCommands()

    if (!result.success) {
      return {
        success: false,
        message: `❌ Installation failed: ${result.error}`,
      }
    }

    console.log(
      `\n✅ Installed ${result.installed?.length ?? 0} commands to:\n   ${pathManager.getDisplayPath(result.path || '')}`
    )

    if ((result.errors?.length ?? 0) > 0) {
      console.log(`\n⚠️  ${result.errors?.length ?? 0} errors:`)
      for (const e of result.errors ?? []) {
        console.log(`   - ${e.file}: ${e.error}`)
      }
    }
  }

  if (codexDetection.installed) {
    try {
      const { installCodexSkill, verifyCodexPRouterReady } = await import(
        '../../infrastructure/setup'
      )
      await installCodexSkill()
      const codexRouter = await verifyCodexPRouterReady({ autoRepair: true })
      if (codexRouter.verified) {
        console.log('✅ Installed Codex skill: ~/.codex/skills/prjct/SKILL.md')
        console.log('✅ Codex p. router ready')
      } else {
        console.log(
          `⚠️  Codex skill setup incomplete: ${codexRouter.message || 'router verification failed'}`
        )
        console.log('   Run `prjct setup` to retry Codex configuration.')
      }
    } catch (error) {
      console.log(`⚠️  Codex skill setup failed (non-blocking): ${getErrorMessage(error)}`)
    }
  }

  await setupMcpServers()

  console.log('\n🎉 Setup complete!')
  console.log('\nNext steps:')
  console.log(`  1. Open ${primaryName}`)
  console.log('  2. Navigate to your project')
  console.log('  3. Run: prjct init')

  return {
    success: true,
    message: '',
  }
}

export async function setup(options: SetupOptions = {}): Promise<CommandResult> {
  console.log('🔧 Reconfiguring prjct...\n')

  if (options.force) {
    console.log('🗑️  Removing existing installation...')
    await commandInstaller.uninstallCommands()
  }

  console.log('📦 Installing /p:* commands...')
  const result = await commandInstaller.installCommands()

  if (!result.success) {
    return {
      success: false,
      message: `❌ Setup failed: ${result.error}`,
    }
  }

  console.log(`\n✅ Installed ${result.installed?.length ?? 0} commands`)

  if ((result.errors?.length ?? 0) > 0) {
    console.log(`\n⚠️  ${result.errors?.length ?? 0} errors:`)
    for (const e of result.errors ?? []) {
      console.log(`   - ${e.file}: ${e.error}`)
    }
  }

  console.log('\n📝 Installing global configuration...')
  const configResult = await commandInstaller.installGlobalConfig()
  const displayPath = configResult.path
    ? pathManager.getDisplayPath(configResult.path)
    : 'global config'

  if (configResult.success) {
    if (configResult.action === 'created') {
      console.log(`✅ Created ${displayPath}`)
    } else if (configResult.action === 'updated') {
      console.log(`✅ Updated ${displayPath}`)
    } else if (configResult.action === 'appended') {
      console.log(`✅ Added prjct config to ${displayPath}`)
    }
  } else {
    console.log(`⚠️  ${configResult.error}`)
  }

  const aiProvider = require('../../infrastructure/ai-provider')
  const activeProvider = await aiProvider.getActiveProvider()
  const codexDetection = await aiProvider.detectCodex()

  // Status line is currently Claude-only
  if (activeProvider.name === 'claude') {
    console.log('\n⚡ Installing status line...')
    const statusLineResult = await installStatusLine()
    if (statusLineResult.success) {
      console.log('✅ Status line configured')
    } else {
      console.log(`⚠️  ${statusLineResult.error}`)
    }
  }

  if (codexDetection.installed) {
    try {
      const { installCodexSkill, verifyCodexPRouterReady } = await import(
        '../../infrastructure/setup'
      )
      await installCodexSkill()
      const codexRouter = await verifyCodexPRouterReady({ autoRepair: true })
      if (codexRouter.verified) {
        console.log('✅ Codex skill installed')
        console.log('✅ Codex p. router ready')
      } else {
        console.log(
          `⚠️  Codex skill setup incomplete: ${codexRouter.message || 'router verification failed'}`
        )
        console.log('   Run `prjct setup` again to retry Codex configuration.')
      }
    } catch (error) {
      console.log(`⚠️  Codex skill setup failed (non-blocking): ${getErrorMessage(error)}`)
    }
  }

  await setupMcpServers()

  console.log('\n🎉 Setup complete!\n')
  showAsciiArt()

  return {
    success: true,
    message: '',
  }
}

export function showAsciiArt(): void {
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log('')
  console.log(chalk.bold.cyan('   ██████╗ ██████╗      ██╗ ██████╗████████╗'))
  console.log(chalk.bold.cyan('   ██╔══██╗██╔══██╗     ██║██╔════╝╚══██╔══╝'))
  console.log(chalk.bold.cyan('   ██████╔╝██████╔╝     ██║██║        ██║'))
  console.log(chalk.bold.cyan('   ██╔═══╝ ██╔══██╗██   ██║██║        ██║'))
  console.log(chalk.bold.cyan('   ██║     ██║  ██║╚█████╔╝╚██████╗   ██║'))
  console.log(chalk.bold.cyan('   ╚═╝     ╚═╝  ╚═╝ ╚════╝  ╚═════╝   ╚═╝'))
  console.log('')
  console.log(
    `   ${chalk.bold.cyan('prjct')}${chalk.magenta('/')}${chalk.green('cli')}  ${chalk.dim.white(`v${VERSION} installed`)}`
  )
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
  console.log(
    `  ${chalk.dim('Report issues:')} ${chalk.cyan('https://github.com/jlopezlira/prjct-cli/issues')}`
  )
  console.log('')
  console.log(chalk.bold.magenta('Happy shipping! 🚀'))
  console.log('')
}
