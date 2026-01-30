/**
 * Help System - Structured help output for prjct CLI
 *
 * Provides consistent, well-formatted help text for all commands.
 *
 * @see PRJ-133
 * @module utils/help
 */

import { CATEGORIES, COMMANDS } from '../commands/command-data'
import type { CommandMeta } from '../types'
import { VERSION } from './version'

// ANSI colors
const CYAN = '\x1b[36m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'

/**
 * Terminal commands that run directly in the shell
 */
const TERMINAL_COMMANDS = [
  {
    name: 'start',
    description: 'First-time setup wizard',
    example: 'prjct start',
  },
  {
    name: 'init',
    description: 'Initialize project in current directory',
    example: 'prjct init',
  },
  {
    name: 'sync',
    description: 'Sync project state and update context files',
    example: 'prjct sync',
  },
  {
    name: 'watch',
    description: 'Auto-sync on file changes',
    example: 'prjct watch',
    options: ['--verbose', '--debounce=<ms>', '--interval=<sec>'],
  },
  {
    name: 'doctor',
    description: 'Check system health and dependencies',
    example: 'prjct doctor',
  },
  {
    name: 'serve',
    description: 'Start web dashboard server',
    example: 'prjct serve [port]',
  },
  {
    name: 'context',
    description: 'Smart context filtering tools for AI',
    example: 'prjct context files "add auth"',
    subcommands: ['files', 'signatures', 'imports', 'recent', 'summary'],
  },
  {
    name: 'linear',
    description: 'Linear issue tracker CLI',
    example: 'prjct linear list',
    subcommands: ['list', 'get', 'create', 'update'],
  },
  {
    name: 'uninstall',
    description: 'Complete system removal of prjct',
    example: 'prjct uninstall --backup',
    options: ['--force', '--backup', '--dry-run', '--keep-package'],
  },
]

/**
 * Global CLI flags
 */
const GLOBAL_FLAGS = [
  { flag: '-q, --quiet', description: 'Suppress all output (errors to stderr only)' },
  { flag: '-v, --version', description: 'Show version and provider status' },
  { flag: '-h, --help', description: 'Show this help message' },
]

/**
 * Format the main help output
 */
export function formatMainHelp(): string {
  const lines: string[] = []

  // Header
  lines.push('')
  lines.push(`${CYAN}${BOLD}prjct${RESET} v${VERSION} - Context layer for AI coding agents`)
  lines.push(`${DIM}Works with Claude Code, Gemini CLI, Cursor, Windsurf, and more.${RESET}`)
  lines.push('')

  // Quick Start
  lines.push(`${BOLD}QUICK START${RESET}`)
  lines.push(`${DIM}${'─'.repeat(60)}${RESET}`)
  lines.push(`  ${GREEN}1.${RESET} prjct start              ${DIM}# Configure AI providers${RESET}`)
  lines.push(`  ${GREEN}2.${RESET} cd my-project && prjct init`)
  lines.push(`  ${GREEN}3.${RESET} Open in Claude Code / Gemini CLI / Cursor`)
  lines.push(`  ${GREEN}4.${RESET} p. sync                  ${DIM}# Analyze project${RESET}`)
  lines.push('')

  // Terminal Commands
  lines.push(`${BOLD}TERMINAL COMMANDS${RESET}`)
  lines.push(`${DIM}${'─'.repeat(60)}${RESET}`)
  for (const cmd of TERMINAL_COMMANDS) {
    const name = `prjct ${cmd.name}`.padEnd(22)
    lines.push(`  ${name} ${cmd.description}`)
  }
  lines.push('')

  // AI Agent Commands
  lines.push(`${BOLD}AI AGENT COMMANDS${RESET} ${DIM}(inside Claude/Gemini/Cursor)${RESET}`)
  lines.push(`${DIM}${'─'.repeat(60)}${RESET}`)
  lines.push(`  ${'Command'.padEnd(22)} Description`)
  lines.push(`  ${DIM}${'─'.repeat(56)}${RESET}`)

  // Core commands
  const coreCommands = COMMANDS.filter((c) => c.group === 'core' && c.usage?.claude)
  for (const cmd of coreCommands.slice(0, 10)) {
    const usage = `p. ${cmd.name}`.padEnd(22)
    lines.push(`  ${usage} ${cmd.description}`)
  }
  lines.push(`  ${DIM}... and ${coreCommands.length - 10} more (run 'prjct help commands')${RESET}`)
  lines.push('')

  // Global Flags
  lines.push(`${BOLD}FLAGS${RESET}`)
  lines.push(`${DIM}${'─'.repeat(60)}${RESET}`)
  for (const flag of GLOBAL_FLAGS) {
    lines.push(`  ${flag.flag.padEnd(22)} ${flag.description}`)
  }
  lines.push('')

  // More Info
  lines.push(`${BOLD}MORE INFO${RESET}`)
  lines.push(`${DIM}${'─'.repeat(60)}${RESET}`)
  lines.push(`  Documentation:  ${CYAN}https://prjct.app${RESET}`)
  lines.push(`  GitHub:         ${CYAN}https://github.com/jlopezlira/prjct-cli${RESET}`)
  lines.push(`  Per-command:    prjct help <command>`)
  lines.push('')

  return lines.join('\n')
}

/**
 * Format help for a specific terminal command
 */
export function formatTerminalCommandHelp(commandName: string): string | null {
  const cmd = TERMINAL_COMMANDS.find((c) => c.name === commandName)
  if (!cmd) return null

  const lines: string[] = []

  lines.push('')
  lines.push(`${CYAN}${BOLD}prjct ${cmd.name}${RESET} - ${cmd.description}`)
  lines.push('')

  lines.push(`${BOLD}USAGE${RESET}`)
  lines.push(`  ${cmd.example}`)
  lines.push('')

  if (cmd.options) {
    lines.push(`${BOLD}OPTIONS${RESET}`)
    for (const opt of cmd.options) {
      lines.push(`  ${opt}`)
    }
    lines.push('')
  }

  if (cmd.subcommands) {
    lines.push(`${BOLD}SUBCOMMANDS${RESET}`)
    for (const sub of cmd.subcommands) {
      lines.push(`  ${sub}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format help for an AI agent command
 */
export function formatAgentCommandHelp(commandName: string): string | null {
  const cmd = COMMANDS.find((c) => c.name === commandName)
  if (!cmd) return null

  const lines: string[] = []

  lines.push('')
  lines.push(`${CYAN}${BOLD}p. ${cmd.name}${RESET} - ${cmd.description}`)
  lines.push('')

  lines.push(`${BOLD}USAGE${RESET}`)
  if (cmd.usage?.claude) {
    lines.push(`  Claude/Gemini:  ${cmd.usage.claude.replace('/p:', 'p. ')}`)
  }
  if (cmd.usage?.terminal) {
    lines.push(`  Terminal:       ${cmd.usage.terminal}`)
  }
  lines.push('')

  if (cmd.params) {
    lines.push(`${BOLD}PARAMETERS${RESET}`)
    lines.push(`  ${cmd.params}`)
    lines.push('')
  }

  if (cmd.features && cmd.features.length > 0) {
    lines.push(`${BOLD}FEATURES${RESET}`)
    for (const feature of cmd.features) {
      lines.push(`  • ${feature}`)
    }
    lines.push('')
  }

  if (cmd.blockingRules) {
    lines.push(`${BOLD}REQUIREMENTS${RESET}`)
    lines.push(`  ${YELLOW}⚠${RESET} ${cmd.blockingRules.check}`)
    lines.push('')
  }

  // Category info
  const category = CATEGORIES[cmd.group]
  if (category) {
    lines.push(`${DIM}Category: ${category.title}${RESET}`)
    if (cmd.isOptional) {
      lines.push(`${DIM}This is an optional command.${RESET}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format help for a specific command (auto-detect type)
 */
export function formatCommandHelp(commandName: string): string {
  // Try terminal command first
  const terminalHelp = formatTerminalCommandHelp(commandName)
  if (terminalHelp) return terminalHelp

  // Try agent command
  const agentHelp = formatAgentCommandHelp(commandName)
  if (agentHelp) return agentHelp

  // Command not found
  return `
${YELLOW}Command '${commandName}' not found.${RESET}

Run 'prjct help' to see all available commands.
`
}

/**
 * Format list of all commands grouped by category
 */
export function formatCommandList(): string {
  const lines: string[] = []

  lines.push('')
  lines.push(`${CYAN}${BOLD}All Commands${RESET}`)
  lines.push('')

  // Group by category
  const categories = Object.entries(CATEGORIES).sort((a, b) => a[1].order - b[1].order)

  for (const [categoryKey, category] of categories) {
    const categoryCommands = COMMANDS.filter((c) => c.group === categoryKey)
    if (categoryCommands.length === 0) continue

    lines.push(
      `${BOLD}${category.title}${RESET} ${DIM}(${categoryCommands.length} commands)${RESET}`
    )
    lines.push(`${DIM}${category.description}${RESET}`)
    lines.push('')

    for (const cmd of categoryCommands) {
      const name = `p. ${cmd.name}`.padEnd(18)
      const desc =
        cmd.description.length > 45 ? `${cmd.description.slice(0, 42)}...` : cmd.description
      lines.push(`  ${name} ${desc}`)
    }
    lines.push('')
  }

  lines.push(`${DIM}Run 'prjct help <command>' for detailed help on a specific command.${RESET}`)
  lines.push('')

  return lines.join('\n')
}

/**
 * Get help output based on topic
 */
export function getHelp(topic?: string): string {
  if (!topic) {
    return formatMainHelp()
  }

  if (topic === 'commands' || topic === 'all') {
    return formatCommandList()
  }

  return formatCommandHelp(topic)
}

export default {
  formatMainHelp,
  formatCommandHelp,
  formatCommandList,
  formatTerminalCommandHelp,
  formatAgentCommandHelp,
  getHelp,
}
