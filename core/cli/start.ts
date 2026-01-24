/**
 * prjct start - Global initialization with beautiful UI
 *
 * First-time setup command that:
 * 1. Shows beautiful ASCII banner
 * 2. Detects available AI providers
 * 3. Lets user select which to configure
 * 4. Installs routers and global config
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import readline from 'readline'
import { VERSION } from '../utils/version'
import { detectAllProviders, Providers } from '../infrastructure/ai-provider'
import type { AIProviderName } from '../types/provider'

// Colors
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'
const MAGENTA = '\x1b[35m'
const CYAN = '\x1b[36m'
const WHITE = '\x1b[37m'
const BG_BLUE = '\x1b[44m'

// True color gradient (cyan -> blue -> purple -> pink)
const G1 = '\x1b[38;2;0;255;255m'    // Cyan
const G2 = '\x1b[38;2;80;180;255m'   // Sky blue
const G3 = '\x1b[38;2;140;120;255m'  // Blue-purple
const G4 = '\x1b[38;2;200;80;220m'   // Purple
const G5 = '\x1b[38;2;255;80;180m'   // Pink

// Large block letters - PRJCT (7 lines tall)
const BANNER = `

${G1} ██████╗ ${G2} ██████╗ ${G3}     ██╗${G4} ██████╗${G5}████████╗${RESET}
${G1} ██╔══██╗${G2} ██╔══██╗${G3}     ██║${G4}██╔════╝${G5}╚══██╔══╝${RESET}
${G1} ██████╔╝${G2} ██████╔╝${G3}     ██║${G4}██║     ${G5}   ██║   ${RESET}
${G1} ██╔═══╝ ${G2} ██╔══██╗${G3}██   ██║${G4}██║     ${G5}   ██║   ${RESET}
${G1} ██║     ${G2} ██║  ██║${G3}╚█████╔╝${G4}╚██████╗${G5}   ██║   ${RESET}
${G1} ╚═╝     ${G2} ╚═╝  ╚═╝${G3} ╚════╝ ${G4} ╚═════╝${G5}   ╚═╝   ${RESET}

`

const WELCOME_BOX = `  ${WHITE}Context Layer for AI Agents${RESET}  ${DIM}v${VERSION}${RESET}

  ${DIM}Project context layer for AI coding agents.
  Works with Claude Code, Gemini CLI, and more.${RESET}
  ${CYAN}https://prjct.app${RESET}
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
function createReadline(): readline.Interface {
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
  console.log(`\n${BOLD}  Select AI providers to configure:${RESET}\n`)
  console.log(`  ${DIM}(Use arrow keys to navigate, space to toggle, enter to confirm)${RESET}\n`)

  options.forEach((option, index) => {
    const cursor = index === currentIndex ? `${CYAN}❯${RESET}` : ' '
    const checkbox = option.selected ? `${GREEN}[✓]${RESET}` : `${DIM}[ ]${RESET}`
    const status = option.installed
      ? `${GREEN}(installed)${RESET}`
      : `${YELLOW}(will install)${RESET}`
    const name = index === currentIndex
      ? `${BOLD}${option.displayName}${RESET}`
      : option.displayName

    console.log(`  ${cursor} ${checkbox} ${name} ${status}`)
  })

  console.log('')
}

/**
 * Interactive provider selection (with fallback for non-TTY)
 */
async function selectProviders(): Promise<AIProviderName[]> {
  const detection = detectAllProviders()

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
  ]

  // If neither installed, select Claude by default
  if (!options.some(o => o.selected)) {
    options[0].selected = true
  }

  // Non-interactive mode: auto-select detected providers
  if (!process.stdin.isTTY) {
    console.log(`\n${BOLD}  Detected providers:${RESET}\n`)
    options.forEach(option => {
      if (option.installed) {
        console.log(`  ${GREEN}✓${RESET} ${option.displayName}`)
      }
    })
    console.log('')
    return options.filter(o => o.selected).map(o => o.name)
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
        const selected = options.filter(o => o.selected).map(o => o.name)
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
    fs.mkdirSync(commandsDir, { recursive: true })

    // Find package root (where templates are)
    const { getPackageRoot } = await import('../utils/version')
    const packageRoot = getPackageRoot()

    // Copy router file
    const routerFile = provider === 'claude' ? 'p.md' : 'p.toml'
    const src = path.join(packageRoot, 'templates', 'commands', routerFile)
    const dest = path.join(commandsDir, routerFile)

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      return true
    }

    return false
  } catch (error) {
    console.error(`  ${YELLOW}⚠${RESET} Failed to install ${provider} router: ${(error as Error).message}`)
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

  try {
    // Ensure config directory exists
    fs.mkdirSync(config.configDir, { recursive: true })

    // Find package root
    const { getPackageRoot } = await import('../utils/version')
    const packageRoot = getPackageRoot()

    // Copy global config
    const configFile = provider === 'claude' ? 'CLAUDE.md' : 'GEMINI.md'
    const src = path.join(packageRoot, 'templates', 'global', configFile)
    const dest = path.join(config.configDir, configFile)

    if (fs.existsSync(src)) {
      const content = fs.readFileSync(src, 'utf-8')

      // Check if file exists and has our markers
      if (fs.existsSync(dest)) {
        const existing = fs.readFileSync(dest, 'utf-8')
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
          fs.writeFileSync(dest, before + prjctSection + after)
        } else {
          // Append
          fs.writeFileSync(dest, existing + '\n\n' + content)
        }
      } else {
        // Create new
        fs.writeFileSync(dest, content)
      }

      return true
    }

    return false
  } catch (error) {
    console.error(`  ${YELLOW}⚠${RESET} Failed to install ${provider} config: ${(error as Error).message}`)
    return false
  }
}

/**
 * Save setup configuration
 */
async function saveSetupConfig(providers: AIProviderName[]): Promise<void> {
  const configDir = path.join(os.homedir(), '.prjct-cli', 'config')
  fs.mkdirSync(configDir, { recursive: true })

  const configPath = path.join(configDir, 'installed-editors.json')
  const config = {
    version: VERSION,
    providers,
    editor: providers[0], // deprecated, for backward compat
    provider: providers[0],
    lastInstall: new Date().toISOString(),
    path: path.join(os.homedir(), `.${providers[0]}`, 'commands'),
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

/**
 * Show completion message
 */
function showCompletion(providers: AIProviderName[]): void {
  console.log(`\n${GREEN}${BOLD}  ✓ Setup complete!${RESET}\n`)

  console.log(`  ${DIM}Configured providers:${RESET}`)
  providers.forEach(p => {
    const config = Providers[p]
    console.log(`    ${GREEN}✓${RESET} ${config.displayName}`)
  })

  console.log(`
  ${BOLD}Next steps:${RESET}

  ${CYAN}1.${RESET} Navigate to your project directory
  ${CYAN}2.${RESET} Run ${BOLD}p. init${RESET} to initialize prjct for that project
  ${CYAN}3.${RESET} Start tracking with ${BOLD}p. task "your task"${RESET}

  ${DIM}Tips:${RESET}
  ${DIM}•${RESET} Use ${BOLD}p. sync${RESET} to analyze your codebase
  ${DIM}•${RESET} Use ${BOLD}p. done${RESET} to complete tasks
  ${DIM}•${RESET} Use ${BOLD}p. ship${RESET} to create PRs

  ${DIM}Learn more: https://prjct.app/docs${RESET}
`)
}

/**
 * Main start command
 */
export async function runStart(): Promise<void> {
  showBanner()

  // Check if already configured
  const configPath = path.join(os.homedir(), '.prjct-cli', 'config', 'installed-editors.json')
  if (fs.existsSync(configPath)) {
    const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (existing.version === VERSION) {
      console.log(`  ${YELLOW}ℹ${RESET} Already configured for v${VERSION}`)
      console.log(`  ${DIM}Run with --force to reconfigure${RESET}\n`)

      if (!process.argv.includes('--force')) {
        return
      }
    }
  }

  // Select providers
  const selectedProviders = await selectProviders()

  console.log(`\n  ${CYAN}Setting up...${RESET}\n`)

  // Install for each selected provider
  for (const provider of selectedProviders) {
    const config = Providers[provider]
    process.stdout.write(`  ${DIM}•${RESET} ${config.displayName}... `)

    const routerOk = await installRouter(provider)
    const configOk = await installGlobalConfig(provider)

    if (routerOk && configOk) {
      console.log(`${GREEN}✓${RESET}`)
    } else if (routerOk || configOk) {
      console.log(`${YELLOW}partial${RESET}`)
    } else {
      console.log(`${YELLOW}skipped${RESET}`)
    }
  }

  // Save configuration
  await saveSetupConfig(selectedProviders)

  // Show completion
  showCompletion(selectedProviders)
}

export default { runStart }
