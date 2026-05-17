/**
 * prjct start - Global initialization with beautiful UI
 *
 * First-time setup command that:
 * 1. Shows beautiful ASCII banner
 * 2. Detects available AI providers
 * 3. Lets user select which to configure
 * 4. Installs routers and global config
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import chalk from 'chalk'
import { getTemplateContent, listTemplates } from '../agentic/template-loader'
import { detectAllProviders, Providers } from '../infrastructure/ai-provider'
import pathManager from '../infrastructure/path-manager'
import { getErrorMessage } from '../types/fs'
import type { AIProviderName } from '../types/provider'
import { fileExists, writeJson } from '../utils/file-helper'
import { VERSION } from '../utils/version'

// Neutral gradient (warm gray -> white)
const G1 = chalk.rgb(180, 180, 175)
const G2 = chalk.rgb(200, 200, 195)
const G3 = chalk.rgb(220, 220, 215)
const G4 = chalk.rgb(235, 235, 230)
const G5 = chalk.rgb(250, 250, 245)

// Large block letters - PRJCT (7 lines tall)
const BANNER = `

${G1(' ██████╗ ')}${G2(' ██████╗ ')}${G3('     ██╗')}${G4(' ██████╗')}${G5('████████╗')}
${G1(' ██╔══██╗')}${G2(' ██╔══██╗')}${G3('     ██║')}${G4('██╔════╝')}${G5('╚══██╔══╝')}
${G1(' ██████╔╝')}${G2(' ██████╔╝')}${G3('     ██║')}${G4('██║     ')}${G5('   ██║   ')}
${G1(' ██╔═══╝ ')}${G2(' ██╔══██╗')}${G3('██   ██║')}${G4('██║     ')}${G5('   ██║   ')}
${G1(' ██║     ')}${G2(' ██║  ██║')}${G3('╚█████╔╝')}${G4('╚██████╗')}${G5('   ██║   ')}
${G1(' ╚═╝     ')}${G2(' ╚═╝  ╚═╝')}${G3(' ╚════╝ ')}${G4(' ╚═════╝')}${G5('   ╚═╝   ')}

`

const WELCOME_BOX = `  ${chalk.white('Context Layer for AI Agents')}  ${chalk.dim(`v${VERSION}`)}

  ${chalk.dim(`Project context layer for AI coding agents.
  Works with Claude Code, Gemini CLI, Codex, and more.`)}
  ${chalk.cyan('https://prjct.app')}
`

interface ProviderOption {
  name: AIProviderName
  displayName: string
  installed: boolean
  selected: boolean
}

/**
 * Create readline interface for user input
 */
function _createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

/**
 * Clear screen and show banner
 */
function showBanner(): void {
  // Clear screen
  console.clear()
  console.log(BANNER)
  console.log(WELCOME_BOX)
}

/**
 * Show provider selection UI
 */
function showProviderSelection(options: ProviderOption[], currentIndex: number): void {
  console.log(`\n${chalk.bold('  Select AI providers to configure:')}\n`)
  console.log(`  ${chalk.dim('(Use arrow keys to navigate, space to toggle, enter to confirm)')}\n`)

  options.forEach((option, index) => {
    const cursor = index === currentIndex ? chalk.cyan('❯') : ' '
    const checkbox = option.selected ? chalk.green('[✓]') : chalk.dim('[ ]')
    const status = option.installed ? chalk.green('(installed)') : chalk.yellow('(will install)')
    const name = index === currentIndex ? chalk.bold(option.displayName) : option.displayName

    console.log(`  ${cursor} ${checkbox} ${name} ${status}`)
  })

  console.log('')
}

/**
 * Interactive provider selection (with fallback for non-TTY)
 */
async function selectProviders(): Promise<AIProviderName[]> {
  const detection = await detectAllProviders()

  const options: ProviderOption[] = [
    {
      name: 'claude',
      displayName: 'Claude Code',
      installed: detection.claude.installed,
      selected: detection.claude.installed,
    },
    {
      name: 'gemini',
      displayName: 'Gemini CLI',
      installed: detection.gemini.installed,
      selected: detection.gemini.installed,
    },
    {
      name: 'codex',
      displayName: 'OpenAI Codex',
      installed: detection.codex.installed,
      selected: detection.codex.installed,
    },
  ]

  // If neither installed, select Claude by default
  if (!options.some((o) => o.selected)) {
    options[0].selected = true
  }

  // Non-interactive mode: auto-select detected providers
  if (!process.stdin.isTTY) {
    console.log(`\n${chalk.bold('  Detected providers:')}\n`)
    options.forEach((option) => {
      if (option.installed) {
        console.log(`  ${chalk.green('✓')} ${option.displayName}`)
      }
    })
    console.log('')
    return options.filter((o) => o.selected).map((o) => o.name)
  }

  return new Promise((resolve) => {
    let currentIndex = 0

    const render = () => {
      process.stdout.write('\x1b[8A')
      process.stdout.write('\x1b[0J')
      showProviderSelection(options, currentIndex)
    }

    showProviderSelection(options, currentIndex)

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const cleanup = () => {
      process.stdin.setRawMode(false)
      process.stdin.removeListener('data', handleKey)
      process.stdin.pause()
    }

    const handleKey = (key: string) => {
      if (key === '\u0003') {
        cleanup()
        console.log('\n  Cancelled.\n')
        process.exit(0)
      }

      if (key === '\r' || key === '\n') {
        cleanup()
        const selected = options.filter((o) => o.selected).map((o) => o.name)
        resolve(selected.length > 0 ? selected : ['claude'])
        return
      }

      if (key === '\x1b[A') {
        currentIndex = Math.max(0, currentIndex - 1)
        render()
      }

      if (key === '\x1b[B') {
        currentIndex = Math.min(options.length - 1, currentIndex + 1)
        render()
      }

      if (key === ' ') {
        options[currentIndex].selected = !options[currentIndex].selected
        render()
      }
    }

    process.stdin.on('data', handleKey)
  })
}

/**
 * Install router for a CLI-based provider (Claude/Gemini)
 * Note: Cursor uses project-level config, not global
 */
async function installRouter(provider: AIProviderName): Promise<boolean> {
  const config = Providers[provider]

  // Skip project-level providers (Cursor)
  if (!config.configDir) {
    return false
  }

  try {
    // Create commands directory
    const commandsDir = path.join(config.configDir, 'commands')
    await fs.mkdir(commandsDir, { recursive: true })

    // Find package root (where templates are)
    const { getPackageRoot } = await import('../utils/version')
    const packageRoot = getPackageRoot()

    // Copy router file
    const routerFile = provider === 'claude' ? 'p.md' : 'p.toml'
    const src = path.join(packageRoot, 'templates', 'commands', routerFile)
    const dest = path.join(commandsDir, routerFile)

    if (await fileExists(src)) {
      await fs.copyFile(src, dest)
      return true
    }

    return false
  } catch (error) {
    console.error(
      `  ${chalk.yellow('⚠')} Failed to install ${provider} router: ${getErrorMessage(error)}`
    )
    return false
  }
}

/**
 * Install subcommand templates (task.md, done.md, etc.) to provider commands dir
 */
async function installSubcommands(provider: AIProviderName): Promise<boolean> {
  const config = Providers[provider]
  if (!config.configDir) return false

  try {
    // Claude uses p/ subdirectory, Gemini uses commands/ directly
    const commandsDir =
      provider === 'gemini'
        ? path.join(config.configDir, 'commands')
        : path.join(config.configDir, 'commands', 'p')
    await fs.mkdir(commandsDir, { recursive: true })

    const routerFiles = new Set(['p.md', 'p.toml'])
    const bundledKeys = listTemplates('commands/')
    const commandFiles = bundledKeys
      .filter((k) => k.endsWith('.md'))
      .map((k) => k.replace('commands/', ''))
      .filter((f) => !routerFiles.has(f))

    for (const file of commandFiles) {
      const content = getTemplateContent(`commands/${file}`)
      if (content) {
        await fs.writeFile(path.join(commandsDir, file), content, 'utf-8')
      }
    }

    return true
  } catch (error) {
    console.error(
      `  ${chalk.yellow('⚠')} Failed to install ${provider} subcommands: ${getErrorMessage(error)}`
    )
    return false
  }
}

/**
 * Install global config for a CLI-based provider (Claude/Gemini)
 * Note: Cursor uses project-level config, not global
 */
async function installGlobalConfig(provider: AIProviderName): Promise<boolean> {
  const config = Providers[provider]

  // Skip project-level providers (Cursor)
  if (!config.configDir) {
    return false
  }

  // Claude has no filesystem template — its managed block lives inline in
  // `command-installer.ts` (GLOBAL_CLAUDE_MD_CONTENT). Delegate to that
  // single source of truth instead of silently skipping when the template
  // isn't on disk.
  if (provider === 'claude') {
    try {
      const { installGlobalConfig: installer } = await import('../infrastructure/command-installer')
      const result = await installer()
      return result.success
    } catch (error) {
      console.error(
        `  ${chalk.yellow('⚠')} Failed to install claude config: ${getErrorMessage(error)}`
      )
      return false
    }
  }

  try {
    // Ensure config directory exists
    await fs.mkdir(config.configDir, { recursive: true })

    // Find package root
    const { getPackageRoot } = await import('../utils/version')
    const packageRoot = getPackageRoot()

    // Copy global config (non-Claude providers — Claude is handled above)
    const configFile = 'GEMINI.md'
    const src = path.join(packageRoot, 'templates', 'global', configFile)
    const dest = path.join(config.configDir, configFile)

    if (await fileExists(src)) {
      const content = await fs.readFile(src, 'utf-8')

      // Check if file exists and has our markers
      if (await fileExists(dest)) {
        const existing = await fs.readFile(dest, 'utf-8')
        const startMarker = '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->'
        const endMarker = '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->'

        if (existing.includes(startMarker) && existing.includes(endMarker)) {
          // Replace between markers
          const before = existing.substring(0, existing.indexOf(startMarker))
          const after = existing.substring(existing.indexOf(endMarker) + endMarker.length)
          const prjctSection = content.substring(
            content.indexOf(startMarker),
            content.indexOf(endMarker) + endMarker.length
          )
          await fs.writeFile(dest, before + prjctSection + after)
        } else {
          // Append
          await fs.writeFile(dest, `${existing}\n\n${content}`)
        }
      } else {
        // Create new
        await fs.writeFile(dest, content)
      }

      return true
    }

    return false
  } catch (error) {
    console.error(
      `  ${chalk.yellow('⚠')} Failed to install ${provider} config: ${getErrorMessage(error)}`
    )
    return false
  }
}

/**
 * Save setup configuration
 */
async function saveSetupConfig(providers: AIProviderName[]): Promise<void> {
  // Route through pathManager so PRJCT_CLI_HOME is honored — must match the
  // not-configured guard (bin/prjct.ts) and editors-config, which now also
  // read this via pathManager. In production (no override) this is exactly
  // `~/.prjct-cli/config`, so behavior is unchanged.
  const configPath = path.join(pathManager.globalConfigDir, 'installed-editors.json')
  const config = {
    version: VERSION,
    providers,
    editor: providers[0], // deprecated, for backward compat
    provider: providers[0],
    lastInstall: new Date().toISOString(),
    path: path.join(os.homedir(), `.${providers[0]}`, 'commands'),
  }

  await writeJson(configPath, config)
}

/**
 * Show completion message
 */
function showCompletion(providers: AIProviderName[]): void {
  console.log(`\n${chalk.green.bold('  ✓ Setup complete!')}\n`)

  console.log(`  ${chalk.dim('Configured providers:')}`)
  providers.forEach((p) => {
    const config = Providers[p]
    console.log(`    ${chalk.green('✓')} ${config.displayName}`)
  })

  console.log(`
  ${chalk.bold('Next steps:')}

  ${chalk.cyan('1.')} Navigate to your project directory
  ${chalk.cyan('2.')} Run ${chalk.bold('p. init')} to initialize prjct for that project
  ${chalk.cyan('3.')} Start tracking with ${chalk.bold('p. task "your task"')}

  ${chalk.dim('Tips:')}
  ${chalk.dim('•')} Use ${chalk.bold('p. sync')} to analyze your codebase
  ${chalk.dim('•')} Use ${chalk.bold('p. done')} to complete tasks
  ${chalk.dim('•')} Use ${chalk.bold('p. ship')} to create PRs

  ${chalk.dim('Learn more: https://prjct.app/docs')}
`)
}

/**
 * Main start command
 */
export async function runStart(): Promise<void> {
  showBanner()

  // Select providers
  const selectedProviders = await selectProviders()

  console.log(`\n  ${chalk.cyan('Setting up...')}\n`)

  // Install for each selected provider
  for (const provider of selectedProviders) {
    const config = Providers[provider]
    process.stdout.write(`  ${chalk.dim('•')} ${config.displayName}... `)

    const routerOk = await installRouter(provider)
    const subcommandsOk = await installSubcommands(provider)
    const configOk = await installGlobalConfig(provider)

    if (routerOk && subcommandsOk && configOk) {
      console.log(chalk.green('✓'))
    } else if (routerOk || configOk) {
      console.log(chalk.yellow('partial'))
    } else {
      console.log(chalk.yellow('skipped'))
    }
  }

  // Save configuration
  await saveSetupConfig(selectedProviders)

  // Show completion
  showCompletion(selectedProviders)
}
