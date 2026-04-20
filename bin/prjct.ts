/**
 * prjct CLI entry point
 *
 * Auto-setup on first use (like Astro, Vite, etc.)
 * Supports both Bun and Node.js runtimes.
 *
 * PERFORMANCE: Daemon fast path uses only node:fs + node:net (no heavy imports).
 * All other modules are loaded dynamically only when needed.
 * Static imports are FORBIDDEN here — ESM hoists them before any code runs.
 */

// Performance: capture process start time (nanosecond precision)
// Exposed via globalThis so core/index.ts can read it for startup time metrics
;(globalThis as Record<string, unknown>).__perfStartNs = process.hrtime.bigint()

// === DAEMON FAST PATH ===
// Only uses node builtins + daemon protocol/client — zero heavy imports.
// If daemon handles the command, process.exit() skips all remaining code.
let _fastArgs = process.argv.slice(2)
let _fastCommand = _fastArgs.find((a) => !a.startsWith('--') && !a.startsWith('-'))

// Commands that bin/prjct.ts handles directly (NOT routed through daemon)
const _binCommands = new Set([
  'daemon',
  'stop',
  'restart',
  'start',
  'setup',
  'update',
  'dev',
  'web',
  'serve',
  'context',
  'hooks',
  'doctor',
  'uninstall',
  'watch',
  'help',
  '-h',
  '--help',
  'version',
  '-v',
  '--version',
])

// v2 verbs registered in the command registry — imported from the single
// source of truth so adding a verb only requires updating one list.
const { REGISTERED_VERBS_SET } = await import('../core/commands/verb-names')

// v2 auto-route: if the first positional isn't a known verb, treat the
// whole argv as a task description and rewrite to `prjct task "<argv>"`.
// Explicit verbs still win.
if (_fastCommand && !_binCommands.has(_fastCommand) && !REGISTERED_VERBS_SET.has(_fastCommand)) {
  const description = _fastArgs.filter((a) => !a.startsWith('-')).join(' ')
  const flags = _fastArgs.filter((a) => a.startsWith('-'))
  _fastCommand = 'task'
  _fastArgs = ['task', description, ...flags]
}

if (_fastCommand && !_binCommands.has(_fastCommand) && process.env.PRJCT_NO_DAEMON !== '1') {
  const fs = await import('node:fs')
  const { DAEMON_PATHS } = await import('../core/daemon/protocol')
  const socketPath = DAEMON_PATHS.socket()

  if (fs.existsSync(socketPath)) {
    const { sendRequest } = await import('../core/daemon/client')
    const crypto = await import('node:crypto')

    // Parse args for daemon
    const commandArgs: string[] = []
    const commandOptions: Record<string, string | boolean> = {}
    for (let i = 0; i < _fastArgs.length; i++) {
      const a = _fastArgs[i]
      if (a.startsWith('--')) {
        const raw = a.slice(2)
        if (raw.includes('=')) {
          const eqIdx = raw.indexOf('=')
          commandOptions[raw.slice(0, eqIdx)] = raw.slice(eqIdx + 1)
        } else if (i + 1 < _fastArgs.length && !_fastArgs[i + 1].startsWith('--')) {
          commandOptions[raw] = _fastArgs[++i]
        } else {
          commandOptions[raw] = true
        }
      } else if (a.startsWith('-') && a.length === 2) {
        commandOptions[a.slice(1)] = true
      } else if (i > 0) {
        commandArgs.push(a)
      }
    }

    try {
      const response = await sendRequest({
        id: crypto.randomUUID(),
        command: _fastCommand,
        args: commandArgs,
        options: commandOptions,
        cwd: process.cwd(),
        perfStartNs: ((globalThis as Record<string, unknown>).__perfStartNs as bigint)?.toString(),
      })

      if (response.stdout) console.log(response.stdout)
      if (response.stderr) console.error(response.stderr)
      process.exit(response.exitCode)
    } catch {
      // Daemon connection failed — fall through to normal path
    }
  }
}

// === NORMAL PATH ===
// Heavy imports loaded dynamically, only when the daemon is not available.

async function main(): Promise<void> {
  const os = await import('node:os')
  const path = await import('node:path')
  const chalk = (await import('chalk')).default
  const { detectAllProviders } = await import('../core/infrastructure/ai-provider')
  const configManager = (await import('../core/infrastructure/config-manager')).default
  const editorsConfig = (await import('../core/infrastructure/editors-config')).default
  const { DEFAULT_PORT, startServer } = await import('../core/server/server')
  const { fileExists } = await import('../core/utils/file-helper')
  const { invalidateProviderCache } = await import('../core/utils/provider-cache')
  const { VERSION } = await import('../core/utils/version')

  async function checkRoutersInstalled(): Promise<boolean> {
    const home = os.homedir()
    const detection = await detectAllProviders()

    // Check that global config has prjct section (routers deprecated — skills are native)
    if (detection.claude.installed) {
      const claudeMd = path.join(home, '.claude', 'CLAUDE.md')
      try {
        const content = await import('node:fs/promises').then((f) => f.readFile(claudeMd, 'utf-8'))
        if (!content.includes('prjct:start')) return false
      } catch {
        return false
      }
    }

    if (detection.gemini.installed) {
      const geminiMd = path.join(home, '.gemini', 'GEMINI.md')
      try {
        const content = await import('node:fs/promises').then((f) => f.readFile(geminiMd, 'utf-8'))
        if (!content.includes('prjct:start')) return false
      } catch {
        return false
      }
    }

    if (!detection.claude.installed && !detection.gemini.installed) return true
    return true
  }

  const args = process.argv.slice(2)

  // Parse --quiet / -q flag
  const quietIndex = args.findIndex((arg) => arg === '--quiet' || arg === '-q')
  const isQuietMode = quietIndex !== -1
  if (isQuietMode) {
    args.splice(quietIndex, 1)
    const { setQuietMode } = await import('../core/utils/output')
    setQuietMode(true)
  }

  // Parse --refresh flag
  const refreshIndex = args.indexOf('--refresh')
  const isRefresh = refreshIndex !== -1
  if (isRefresh) {
    args.splice(refreshIndex, 1)
    await invalidateProviderCache()
  }

  // Session tracking for commands that bypass core/index.ts
  async function trackSession(command: string): Promise<() => void> {
    const start = Date.now()
    try {
      const projectId = await configManager.getProjectId(process.cwd())
      if (projectId) {
        const { sessionTracker } = await import('../core/services/session-tracker')
        await sessionTracker.expireIfStale(projectId)
        await sessionTracker.touch(projectId)
        return () => {
          const durationMs = Date.now() - start
          sessionTracker.trackCommand(projectId, command, durationMs).catch(() => {})
          import('../core/infrastructure/performance-tracker')
            .then(({ performanceTracker }) => {
              performanceTracker
                .recordTiming(projectId, 'command_duration', durationMs, { command })
                .catch(() => {})
              performanceTracker.recordMemory(projectId, { command }).catch(() => {})
            })
            .catch(() => {})
        }
      }
    } catch {
      // Non-critical
    }
    return () => {}
  }

  if (args[0] === 'daemon') {
    const subcommand = args[1] || 'status'

    if (subcommand === 'start') {
      const { isDaemonRunning, spawnDaemon } = await import('../core/daemon/client')

      if (await isDaemonRunning()) {
        console.log('Daemon is already running.')
        process.exitCode = 0
      } else {
        const foreground = args.includes('--foreground') || args.includes('-f')

        if (foreground) {
          const { startDaemon } = await import('../core/daemon/daemon')
          const port =
            parseInt(args.find((a) => a.startsWith('--port='))?.split('=')[1] || '', 10) ||
            undefined
          const noHttp = args.includes('--no-http')
          await startDaemon({ port, noHttp, foreground: true })
        } else {
          const started = await spawnDaemon()
          if (started) {
            console.log('Daemon started.')
          } else {
            console.error('Failed to start daemon.')
            process.exitCode = 1
          }
        }
      }
    } else if (subcommand === 'stop') {
      const { isDaemonRunning, stopDaemon } = await import('../core/daemon/client')

      if (await isDaemonRunning()) {
        const stopped = await stopDaemon()
        console.log(stopped ? 'Daemon stopped.' : 'Failed to stop daemon.')
        process.exitCode = stopped ? 0 : 1
      } else {
        console.log('Daemon is not running.')
        process.exitCode = 0
      }
    } else if (subcommand === 'status') {
      const { getDaemonStatus } = await import('../core/daemon/client')
      const status = await getDaemonStatus()

      if (status.running) {
        const uptime = status.uptime ? Math.round(status.uptime / 1000) : 0
        const stale = (status as Record<string, unknown>).stale
        console.log(`Daemon running (PID ${status.pid})${stale ? ' ⚠ STALE' : ''}`)
        console.log(`  Uptime: ${uptime}s`)
        console.log(`  Commands served: ${status.commandsServed ?? 0}`)
        if (status.lastActivity) {
          console.log(`  Last activity: ${status.lastActivity}`)
        }
        if (stale) {
          console.log(
            `  ${chalk.yellow('⚠ Code changed since daemon started. Run: prjct restart')}`
          )
        }
      } else {
        console.log('Daemon is not running.')
      }
      process.exitCode = 0
    } else {
      console.error(`Unknown daemon command: ${subcommand}. Use: start, stop, status`)
      process.exitCode = 1
    }
  } else if (args[0] === 'stop') {
    // Top-level shortcut: prjct stop → kill daemon (with force-kill fallback)
    const { isDaemonRunning, stopDaemon, forceKillDaemon } = await import('../core/daemon/client')
    const force = args.includes('--force') || args.includes('-f')

    if (force) {
      const killed = forceKillDaemon()
      console.log(killed ? 'Daemon force-killed.' : 'Daemon is not running.')
      process.exitCode = 0
    } else if (await isDaemonRunning()) {
      const stopped = await stopDaemon()
      if (stopped) {
        console.log('Daemon stopped.')
        process.exitCode = 0
      } else {
        // Graceful stop failed — force kill
        console.log('Graceful stop failed, force-killing...')
        forceKillDaemon()
        console.log('Daemon force-killed.')
        process.exitCode = 0
      }
    } else {
      // Check for stale files even if daemon not responding
      forceKillDaemon()
      console.log('Daemon is not running (cleaned up stale files).')
      process.exitCode = 0
    }
  } else if (args[0] === 'restart') {
    // Top-level shortcut: prjct restart → stop + start daemon
    const { isDaemonRunning, stopDaemon, forceKillDaemon, spawnDaemon } = await import(
      '../core/daemon/client'
    )

    // Stop first (graceful → force)
    if (await isDaemonRunning()) {
      const stopped = await stopDaemon()
      if (!stopped) {
        forceKillDaemon()
      }
      // Wait for process to fully exit
      await new Promise((resolve) => setTimeout(resolve, 300))
    } else {
      // Clean up any stale files
      forceKillDaemon()
    }

    // Start fresh
    const started = await spawnDaemon()
    if (started) {
      console.log('Daemon restarted.')
      process.exitCode = 0
    } else {
      console.error('Failed to restart daemon.')
      process.exitCode = 1
    }
  } else if (args[0] === 'start' || args[0] === 'setup') {
    const { runStart } = await import('../core/cli/start')
    await runStart()
  } else if (args[0] === 'dev') {
    console.log('Dev mode is not yet implemented.')
    console.log('Use "prjct serve" to start the web server.')
    process.exitCode = 0
  } else if (args[0] === 'web' || args[0] === 'serve') {
    try {
      const projectPath = process.cwd()
      const projectId = await configManager.getProjectId(projectPath)

      if (!projectId) {
        console.error('No prjct project found. Run "prjct init" first.')
        process.exitCode = 1
      } else {
        const port = parseInt(args[1], 10) || DEFAULT_PORT
        await startServer(projectId, projectPath, port)
      }
    } catch (error) {
      console.error('Server error:', (error as Error).message)
      process.exitCode = 1
    }
  } else if (args[0] === 'context') {
    const projectPath = process.cwd()
    const projectId = await configManager.getProjectId(projectPath)

    if (!projectId) {
      console.error('No prjct project found. Run "prjct init" first.')
      process.exitCode = 1
    } else {
      const done = await trackSession('context')
      // Strip --md and --json flags before passing to context tools
      const contextArgs = args.slice(1).filter((a) => a !== '--md' && a !== '--json')
      const mdMode = args.includes('--md')

      if (contextArgs.length === 0) {
        // No subcommand: return project context
        const { ContextCommands } = await import('../core/commands/context')
        const contextCmds = new ContextCommands()
        const result = await contextCmds.context(null, projectPath, { md: mdMode })
        process.exitCode = result.success ? 0 : 1
      } else {
        const { runContextTool } = await import('../core/tools/context')
        const result = await runContextTool(contextArgs, projectId, projectPath)
        console.log(JSON.stringify(result, null, 2))
        process.exitCode = result.tool === 'error' ? 1 : 0
      }
      done()
    }
  } else if (args[0] === 'hooks') {
    const done = await trackSession('hooks')
    const { hooksService } = await import('../core/services/hooks-service')
    const subcommand = args[1] || 'status'
    const exitCode = await hooksService.run(process.cwd(), subcommand)
    process.exitCode = exitCode
    done()
  } else if (args[0] === 'doctor') {
    const done = await trackSession('doctor')
    const { doctorService } = await import('../core/services/doctor-service')
    const exitCode = await doctorService.run(process.cwd())
    process.exitCode = exitCode
    done()
  } else if (args[0] === 'uninstall') {
    const { uninstall } = await import('../core/commands/uninstall')
    const force = args.includes('--force') || args.includes('-f')
    const backup = args.includes('--backup') || args.includes('-b')
    const dryRun = args.includes('--dry-run') || args.includes('-n')
    const keepPackage = args.includes('--keep-package')
    const result = await uninstall({ force, backup, dryRun, keepPackage })
    process.exitCode = result.success ? 0 : 1
  } else if (args[0] === 'watch') {
    const projectPath = process.cwd()
    const projectId = await configManager.getProjectId(projectPath)

    if (!projectId) {
      console.error('No prjct project found. Run "prjct init" first.')
      process.exitCode = 1
    } else {
      const { watchService } = await import('../core/services/watch-service')
      const verbose = args.includes('--verbose') || args.includes('-v')
      const debounceArg = args.find((a) => a.startsWith('--debounce='))
      const debounceMs = debounceArg ? parseInt(debounceArg.split('=')[1], 10) : undefined
      const intervalArg = args.find((a) => a.startsWith('--interval='))
      const minIntervalMs = intervalArg ? parseInt(intervalArg.split('=')[1], 10) * 1000 : undefined

      const result = await watchService.start(projectPath, {
        verbose,
        quiet: isQuietMode,
        debounceMs,
        minIntervalMs,
      })

      if (!result.success) {
        console.error(result.error)
        process.exitCode = 1
      }
    }
  } else if (args[0] === 'help' || args[0] === '-h' || args[0] === '--help') {
    const { getHelp } = await import('../core/utils/help')
    const topic = args[1]
    console.log(getHelp(topic))
    process.exitCode = 0
  } else if (args[0] === 'version' || args[0] === '-v' || args[0] === '--version') {
    const detection = await detectAllProviders(isRefresh)
    const home = os.homedir()
    const cwd = process.cwd()
    const [
      claudeConfigured,
      geminiConfigured,
      cursorDetected,
      cursorConfigured,
      windsurfDetected,
      windsurfConfigured,
    ] = await Promise.all([
      fileExists(path.join(home, '.claude', 'commands', 'p.md')),
      fileExists(path.join(home, '.gemini', 'commands', 'p.toml')),
      fileExists(path.join(cwd, '.cursor')),
      fileExists(path.join(cwd, '.cursor', 'rules', 'prjct.mdc')),
      fileExists(path.join(cwd, '.windsurf')),
      fileExists(path.join(cwd, '.windsurf', 'rules', 'prjct.md')),
    ])

    console.log(`
${chalk.cyan('p/')} prjct v${VERSION}
${chalk.dim('Context layer for AI coding agents')}

${chalk.dim('Providers:')}`)

    if (detection.claude.installed) {
      const status = claudeConfigured ? chalk.green('✓ ready') : chalk.yellow('● installed')
      const ver = detection.claude.version ? ` (v${detection.claude.version})` : ''
      console.log(`  Claude Code   ${status}${chalk.dim(ver)}`)
    } else {
      console.log(`  Claude Code   ${chalk.dim('○ not installed')}`)
    }

    if (detection.gemini.installed) {
      const status = geminiConfigured ? chalk.green('✓ ready') : chalk.yellow('● installed')
      const ver = detection.gemini.version ? ` (v${detection.gemini.version})` : ''
      console.log(`  Gemini CLI    ${status}${chalk.dim(ver)}`)
    } else {
      console.log(`  Gemini CLI    ${chalk.dim('○ not installed')}`)
    }

    if (cursorDetected) {
      const status = cursorConfigured ? chalk.green('✓ ready') : chalk.yellow('● detected')
      console.log(`  Cursor IDE    ${status}${chalk.dim(' (project)')}`)
    } else {
      console.log(`  Cursor IDE    ${chalk.dim('○ not detected')}`)
    }

    if (windsurfDetected) {
      const status = windsurfConfigured ? chalk.green('✓ ready') : chalk.yellow('● detected')
      console.log(`  Windsurf IDE  ${status}${chalk.dim(' (project)')}`)
    } else {
      console.log(`  Windsurf IDE  ${chalk.dim('○ not detected')}`)
    }

    console.log(`
${chalk.dim("Run 'prjct start' to configure (CLI providers)")}
${chalk.dim("Run 'prjct init' to configure (Cursor/Windsurf IDE)")}
${chalk.cyan('https://prjct.app')}
`)
  } else {
    // Default: check setup, auto-update, then run
    const configPath = path.join(os.homedir(), '.prjct-cli', 'config', 'installed-editors.json')
    const routersInstalled = await checkRoutersInstalled()

    // Commands that work without full setup
    const noSetupRequired = new Set(['auth', 'login', 'logout', 'init'])

    if (!noSetupRequired.has(args[0]) && (!(await fileExists(configPath)) || !routersInstalled)) {
      console.log(`
${chalk.cyan.bold('  Welcome to prjct!')}

  Run ${chalk.bold('prjct start')} to configure your AI providers.

  ${chalk.dim(`This is a one-time setup that lets you choose between
  Claude Code, Gemini CLI, or both.`)}
`)
      process.exitCode = 0
    } else {
      // Auto-update if version changed
      try {
        const lastVersion = await editorsConfig.getLastVersion()
        if (lastVersion && lastVersion !== VERSION) {
          console.log(`\n${chalk.yellow('ℹ')} Updating prjct v${lastVersion} → v${VERSION}...\n`)
          try {
            const { default: setup } = await import('../core/infrastructure/setup')
            await setup.run()
          } catch {
            // setup.run() may fail (e.g. provider detection) — stamp version anyway
            await editorsConfig.updateVersion(VERSION).catch(() => {})
          }
        }
      } catch {
        // Silent fail
      }

      // Auto-start daemon in background for future commands
      if (args.length > 0 && process.env.PRJCT_NO_DAEMON !== '1') {
        import('../core/daemon/client').then(({ spawnDaemon }) => spawnDaemon()).catch(() => {})
      }
      await import('../core/index')
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', (error as Error).message)
  process.exit(1)
})
