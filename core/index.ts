/**
 * prjct CLI - Main Entry Point
 *
 * This file is required by bin/prjct after setup verification
 */

import { PrjctCommands } from './commands/commands'
import { commandRegistry } from './commands/registry'
import './commands/register' // Ensure commands are registered
import os from 'node:os'
import path from 'node:path'
import chalk from 'chalk'
import type { CommandMeta } from './commands/registry'
import { detectAllProviders, detectAntigravity } from './infrastructure/ai-provider'
import configManager from './infrastructure/config-manager'
import performanceTracker from './infrastructure/performance-tracker'
import { sessionTracker } from './services/session-tracker'
import { getErrorMessage, getErrorStack } from './types/fs'
import { getError } from './utils/error-messages'
import { fileExists } from './utils/file-helper'
import out from './utils/output'

interface ParsedCommandArgs {
  parsedArgs: string[]
  options: Record<string, string | boolean>
}

interface CommandResult {
  success?: boolean
  message?: string
}

async function main(): Promise<void> {
  let [commandName, ...rawArgs] = process.argv.slice(2)

  // === SPECIAL COMMANDS (version, help) ===

  if (['-v', '--version', 'version'].includes(commandName)) {
    const packageJson = await import('../package.json')
    await displayVersion(packageJson.version)
    process.exit(0)
  }

  if (['-h', '--help', undefined].includes(commandName)) {
    displayHelp()
    process.exit(0)
  }

  // === v2 auto-route: unknown verb → prjct task "<full args>" ===
  // Prjct doesn't classify intent; Claude tags the task afterwards with
  // `prjct tag type:<bug|feature|chore>`. If the user types `prjct fix
  // login bug`, we treat that as a task description. Explicit verbs
  // (task, ship, tag, …) still win.
  //
  // Exception: a single-word input that's a near-match of a real verb
  // (edit distance ≤ 2, no whitespace) is probably a typo. Surface the
  // did-you-mean instead of silently creating `prjct task "shipp"`.
  if (commandName && !commandRegistry.getByName(commandName)) {
    const looksLikeTypo = rawArgs.length === 0 && findClosestCommand(commandName) !== null
    if (!looksLikeTypo) {
      const fullDescription = [commandName, ...rawArgs.filter((a) => !a.startsWith('-'))].join(' ')
      const passthroughFlags = rawArgs.filter((a) => a.startsWith('-'))
      commandName = 'task'
      rawArgs = [fullDescription, ...passthroughFlags]
    }
  }

  // === DYNAMIC COMMAND EXECUTION ===

  // Show branding header (skip in --md mode — LLM output is self-contained)
  const isMdMode = rawArgs.includes('--md')
  if (!isMdMode) out.start()

  try {
    // 1. Find command in registry
    const cmd = commandRegistry.getByName(commandName)

    if (!cmd) {
      const suggestion = findClosestCommand(commandName)
      const hint = suggestion
        ? `Did you mean 'prjct ${suggestion}'? Run 'prjct --help' for all commands`
        : "Run 'prjct --help' to see available commands"
      out.failWithHint(
        getError('UNKNOWN_COMMAND', { message: `Unknown command: ${commandName}`, hint })
      )
      if (!isMdMode) out.end()
      process.exit(1)
    }

    // 2. Check if deprecated
    if (cmd.deprecated) {
      const hint = cmd.replacedBy
        ? `Use 'prjct ${cmd.replacedBy}' instead`
        : "Run 'prjct --help' to see available commands"
      out.failWithHint({ message: `Command '${commandName}' is deprecated`, hint })
      if (!isMdMode) out.end()
      process.exit(1)
    }

    // 3. Check if implemented
    if (!cmd.implemented) {
      out.failWithHint({
        message: `Command '${commandName}' is not yet implemented`,
        hint: "Run 'prjct --help' to see available commands",
        docs: 'https://github.com/jlopezlira/prjct-cli',
      })
      if (!isMdMode) out.end()
      process.exit(1)
    }

    // 4. Parse arguments
    const { parsedArgs, options } = parseCommandArgs(cmd, rawArgs)

    // 4.5. Block commands that require LLM processing when run in raw terminal
    const isLlmContext = !process.stdin.isTTY || options.md === true || options.json === true
    if (cmd.requiresLlm && !isLlmContext) {
      out.failWithHint({
        message: `'prjct ${commandName}' requires an AI agent to process its output`,
        hint: `Use 'p. ${commandName}' inside Claude/Cursor, or add --md flag`,
      })
      if (!isMdMode) out.end()
      process.exit(1)
    }

    // 4.6. Validate required params
    const paramError = validateCommandParams(cmd, parsedArgs)
    if (paramError) {
      out.failWithHint(paramError)
      if (!isMdMode) out.end()
      process.exit(1)
    }

    // 4.6. Session tracking — touch/create session before command execution
    let projectId: string | null = null
    const commandStartTime = Date.now()
    try {
      projectId = await configManager.getProjectId(process.cwd())
      if (projectId) {
        await sessionTracker.expireIfStale(projectId)
        await sessionTracker.touch(projectId)
      }
    } catch {
      // Session tracking is non-critical — silent fail
    }

    // 5. Instantiate commands handler
    const commands = new PrjctCommands()

    // 6. Execute command
    let result: CommandResult | undefined

    // Commands with special option handling
    if (commandName === 'analyze') {
      result = await commands.analyze(options)
    } else if (commandName === 'setup') {
      result = await commands.setup(options)
    } else if (commandName === 'update') {
      result = await commands.update(options)
    } else {
      // Standard commands - type-safe invocation
      const param = parsedArgs.join(' ') || null
      const md = options.md === true
      const standardCommands: Record<string, (p: string | null) => Promise<CommandResult>> = {
        // Core workflow
        task: (p) => commands.task(p, process.cwd(), { md }),
        // Planning — init accepts --pack / --persona / --yes to pre-seed
        // packs and persona without the interactive wizard.
        init: (p) =>
          commands.init({
            idea: p,
            yes: options.yes === true,
            pack: options.pack ? String(options.pack) : undefined,
            persona: options.persona ? String(options.persona) : undefined,
          }),
        ship: (p) => commands.ship(p, process.cwd(), { md }),
        // Workflow
        workflow: (p) => commands.workflowPrefs(p, process.cwd(), { md }),
        // Setup
        sync: () =>
          commands.sync(process.cwd(), {
            preview: options.preview === true || options['dry-run'] === true,
            yes: options.yes === true,
            json: options.json === true,
            md,
            package: options.package ? String(options.package) : undefined,
            full: options.full === true,
          }),
        diff: () => commands.diff(process.cwd(), { json: options.json === true, md }),
        seal: () => commands.seal(process.cwd(), { json: options.json === true }),
        rollback: () => commands.rollback(process.cwd(), { json: options.json === true, md }),
        verify: () =>
          commands.verify(process.cwd(), {
            json: options.json === true,
            semantic: options.semantic === true,
          }),
        'analysis-payload': () =>
          commands.analysisPayload(process.cwd(), { json: options.json === true, md }),
        'analysis-save-llm': (p) => commands.saveLlmAnalysis(p || '', process.cwd(), { md }),
        'analysis-llm': () =>
          commands.getLlmAnalysis(process.cwd(), { json: options.json === true, md }),
        start: () => commands.start(),
        // Context (for Claude templates)
        context: (p) => commands.context(p),
        // v2 primitives
        status: (p) => commands.status(p, process.cwd(), { md }),
        tag: (p) => commands.tag(p, process.cwd(), { md }),
        remember: (p) =>
          commands.remember(p, process.cwd(), {
            md,
            tags: options.tags ? String(options.tags) : undefined,
          }),
        // Auth (cloud sync)
        login: () => commands.login({ md, url: options.url ? String(options.url) : undefined }),
        logout: () => commands.logout(),
        auth: (p) => commands.auth(p, { md }),
        // v2 alpha.8 packs + Claude Code hook install
        seed: (p) => commands.seed(p, process.cwd(), { md }),
        install: () => commands.install(null, process.cwd(), { md }),
      }

      const handler = standardCommands[commandName]
      if (handler) {
        result = await handler(param)
      } else {
        throw new Error(`Command '${commandName}' has no handler`)
      }
    }

    // 7. Track command in session + performance metrics
    if (projectId) {
      const durationMs = Date.now() - commandStartTime
      try {
        await sessionTracker.trackCommand(projectId, commandName, durationMs)
      } catch {
        // Non-critical
      }

      // Performance tracking (non-critical)
      try {
        // Record command duration
        await performanceTracker.recordTiming(projectId, 'command_duration', durationMs, {
          command: commandName,
        })

        // Record startup time (from bin/prjct.ts marker if available)
        const perfStartNs = (globalThis as Record<string, unknown>).__perfStartNs as
          | bigint
          | undefined
        if (perfStartNs) {
          const startupMs = Number(process.hrtime.bigint() - perfStartNs) / 1_000_000
          await performanceTracker.recordTiming(projectId, 'startup_time', startupMs)
        }

        // Record memory snapshot
        await performanceTracker.recordMemory(projectId, { command: commandName })
      } catch {
        // Performance tracking is non-critical
      }
    }

    // 8. Display result
    if (result?.message) {
      console.log(result.message)
    }

    // Show branding footer
    if (!isMdMode) out.end()
    process.exit(result?.success ? 0 : 1)
  } catch (error) {
    console.error('Error:', getErrorMessage(error))
    if (process.env.DEBUG) {
      console.error(getErrorStack(error))
    }
    // Show branding footer even on error
    if (!isMdMode) out.end()
    process.exit(1)
  }
}

/**
 * Validate that required params are provided
 * Parses CommandMeta.params: <required> vs [optional]
 */
function validateCommandParams(
  cmd: CommandMeta,
  parsedArgs: string[]
): import('./types/errors').ErrorWithHint | null {
  if (!cmd.params) return null

  // Extract required params: tokens wrapped in <angle brackets>
  const requiredParams = cmd.params.match(/<[^>]+>/g)
  if (!requiredParams || requiredParams.length === 0) return null

  // Check if enough positional args provided
  if (parsedArgs.length < requiredParams.length) {
    const paramNames = requiredParams.map((p) => p.slice(1, -1)).join(', ')
    const usage = cmd.usage.terminal || `prjct ${cmd.name} ${cmd.params}`
    return getError('MISSING_PARAM', {
      message: `Missing required parameter: ${paramNames}`,
      hint: `Usage: ${usage}`,
    })
  }

  return null
}

/**
 * Find closest matching command name for did-you-mean suggestions
 * Uses Levenshtein edit distance — suggests if distance <= 2
 */
function findClosestCommand(input: string): string | null {
  const allNames = commandRegistry.getAll().map((c) => c.name)
  let best: string | null = null
  let bestDist = Infinity

  for (const name of allNames) {
    const dist = editDistance(input.toLowerCase(), name.toLowerCase())
    if (dist < bestDist) {
      bestDist = dist
      best = name
    }
  }

  // Only suggest if edit distance is at most 2
  return bestDist <= 2 ? best : null
}

function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/**
 * Parse command arguments dynamically
 */
function parseCommandArgs(_cmd: CommandMeta, rawArgs: string[]): ParsedCommandArgs {
  const parsedArgs: string[] = []
  const options: Record<string, string | boolean> = {}

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]

    if (arg.startsWith('--')) {
      // Handle flags
      const flagName = arg.slice(2)

      // Check if next arg is a value
      if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('--')) {
        options[flagName] = rawArgs[++i]
      } else {
        options[flagName] = true
      }
    } else {
      parsedArgs.push(arg)
    }
  }

  return { parsedArgs, options }
}

// Colors via chalk (respects NO_COLOR env)

/**
 * Display version with provider status
 */
async function displayVersion(version: string): Promise<void> {
  const detection = await detectAllProviders()

  // Check if prjct commands are installed for each provider
  const claudeCommandPath = path.join(os.homedir(), '.claude', 'commands', 'p.md')
  const geminiCommandPath = path.join(os.homedir(), '.gemini', 'commands', 'p.toml')
  const [claudeConfigured, geminiConfigured, cursorConfigured, cursorExists] = await Promise.all([
    fileExists(claudeCommandPath),
    fileExists(geminiCommandPath),
    fileExists(path.join(process.cwd(), '.cursor', 'commands', 'sync.md')),
    fileExists(path.join(process.cwd(), '.cursor')),
  ])

  // Antigravity status (global, skills-based)
  const antigravityDetection = await detectAntigravity()

  console.log(`
${chalk.cyan('p/')} prjct v${version}
${chalk.dim('Context layer for AI coding agents')}

${chalk.dim('Providers:')}`)

  // Claude status
  if (detection.claude.installed) {
    const status = claudeConfigured ? chalk.green('✓ ready') : chalk.yellow('● installed')
    const ver = detection.claude.version ? ` (v${detection.claude.version})` : ''
    console.log(`  Claude Code   ${status}${chalk.dim(ver)}`)
  } else {
    console.log(`  Claude Code   ${chalk.dim('○ not installed')}`)
  }

  // Gemini status
  if (detection.gemini.installed) {
    const status = geminiConfigured ? chalk.green('✓ ready') : chalk.yellow('● installed')
    const ver = detection.gemini.version ? ` (v${detection.gemini.version})` : ''
    console.log(`  Gemini CLI    ${status}${chalk.dim(ver)}`)
  } else {
    console.log(`  Gemini CLI    ${chalk.dim('○ not installed')}`)
  }

  if (antigravityDetection.installed) {
    const status = antigravityDetection.skillInstalled
      ? chalk.green('✓ ready')
      : chalk.yellow('● detected')
    const hint = antigravityDetection.skillInstalled ? '' : ` ${chalk.dim('(run prjct start)')}`
    console.log(`  Antigravity   ${status}${hint}`)
  } else {
    console.log(`  Antigravity   ${chalk.dim('○ not installed')}`)
  }

  // Cursor status (project-level, but shown in same format)
  if (cursorConfigured) {
    console.log(`  Cursor IDE    ${chalk.green('✓ ready')} ${chalk.dim('(use /sync, /task)')}`)
  } else if (cursorExists) {
    console.log(`  Cursor IDE    ${chalk.yellow('● detected')} ${chalk.dim('(run prjct init)')}`)
  } else {
    console.log(`  Cursor IDE    ${chalk.dim('○ no .cursor/ folder')}`)
  }

  console.log(`
${chalk.dim("Run 'prjct start' for Claude/Gemini, 'prjct init' for Cursor")}
${chalk.cyan('https://prjct.app')}
`)
}

/**
 * Display help using registry
 */
function displayHelp(): void {
  console.log(`
prjct - Context layer for AI coding agents
Works with Claude Code, Gemini CLI, Antigravity, Cursor IDE, and more.

QUICK START
-----------
  Claude/Gemini:
    1. prjct start              Configure your AI provider
    2. cd my-project && prjct init
    3. Open in Claude Code or Gemini CLI
    4. Type: p. sync            Analyze project

  Cursor IDE:
    1. cd my-project && prjct init
    2. Open in Cursor
    3. Type: /sync              Analyze project

COMMANDS (inside your AI agent)
-------------------------------
  Claude/Gemini          Cursor            Description
  ─────────────────────────────────────────────────────
  p. sync                /sync             Analyze project
  p. task "desc"         /task "desc"      Start a task
  p. done                /done             Complete subtask
  p. ship "name"         /ship "name"      Ship with PR

TERMINAL COMMANDS (this CLI)
----------------------------
  prjct start            First-time setup (Claude/Gemini global config)
  prjct init             Initialize project (required for Cursor)
  prjct setup            Reconfigure installations
  prjct sync             Sync project state
  prjct watch            Auto-sync on file changes (Ctrl+C to stop)
  prjct hooks            Manage git hooks for auto-sync
  prjct doctor           Check system health and dependencies

EXAMPLES
--------
  # Claude Code / Gemini CLI (global setup, then per-project)
  $ prjct start
  $ cd my-project && prjct init
  > p. sync
  > p. task "add user authentication"

  # Cursor IDE (per-project only)
  $ cd my-project && prjct init
  > /sync
  > /task "add user authentication"

FLAGS
-----
  --quiet, -q            Suppress all output (only errors to stderr)
  --version, -v          Show version
  --help, -h             Show this help

MORE INFO
---------
  Documentation:  https://prjct.app
  GitHub:         https://github.com/jlopezlira/prjct-cli
`)
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', getErrorMessage(error))
  if (process.env.DEBUG) {
    console.error(getErrorStack(error))
  }
  process.exit(1)
})
