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
  'context',
  'hooks',
  'doctor',
  'uninstall',
  'claude',
  'hook',
  'seed',
  'install',
  'crew',
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

// Update notice — print at process exit so the banner appears AFTER the
// command's own output. Uses a sync read of the cached latest version;
// the cache is refreshed in a detached background process so the
// network call never delays the user-visible command. Skipped for
// machine-consumed paths (`hook`, `--md`/`--json`, `--quiet`) and for
// the updater itself. Awaited at top-level so the exit handler is
// installed BEFORE the daemon fast path's `process.exit` runs.
const _updateSkipCommands = new Set(['update', 'daemon', 'hook', 'version', '-v', '--version'])
if (
  _fastCommand &&
  !_updateSkipCommands.has(_fastCommand) &&
  process.stderr.isTTY &&
  !_fastArgs.includes('--md') &&
  !_fastArgs.includes('--json') &&
  !_fastArgs.includes('--quiet') &&
  !_fastArgs.includes('-q') &&
  process.env.PRJCT_NO_UPDATE_NOTICE !== '1'
) {
  const { triggerBackgroundRefreshIfStale, getUpdateNotificationSync } = await import(
    '../core/infrastructure/update-checker'
  )
  // Resolve the running version once, synchronously, so the exit
  // handler (which can't await) has it ready.
  const _fs = await import('node:fs')
  const _path = await import('node:path')
  let _currentVersion = ''
  try {
    const pkgPath = _path.resolve(
      _path.dirname(new URL(import.meta.url).pathname),
      '..',
      'package.json'
    )
    _currentVersion = JSON.parse(_fs.readFileSync(pkgPath, 'utf-8')).version ?? ''
  } catch {
    /* no version, no banner */
  }
  try {
    triggerBackgroundRefreshIfStale()
  } catch {
    /* best-effort */
  }
  if (_currentVersion) {
    process.on('exit', () => {
      try {
        const banner = getUpdateNotificationSync(_currentVersion)
        if (banner) process.stderr.write(banner)
      } catch {
        /* never block exit on a notification */
      }
    })
  }
}

// === SELF-HEAL ===
// Re-install hooks + global CLAUDE.md when the binary version has moved
// past the last successful sync. Replaces postinstall (which is disabled
// by --ignore-scripts and corporate security policies on many client
// machines). Hot path is a single fs read of the stamp file; the slow
// path (a few writes to settings.json + CLAUDE.md) only fires once per
// version bump per machine.
//
// Skipped for:
//   - `daemon`/`update`/`version` (would deadlock the upgrade flow)
//   - `hook` (session-start fires its own self-heal; other hook events
//     fire too often to pay even the fs-read cost)
//   - PRJCT_NO_SELF_SYNC=1 (escape hatch)
const _selfHealSkip = new Set(['daemon', 'update', 'version', '-v', '--version', 'hook'])
if (_fastCommand && !_selfHealSkip.has(_fastCommand) && process.env.PRJCT_NO_SELF_SYNC !== '1') {
  try {
    const { VERSION } = await import('../core/utils/version')
    if (VERSION) {
      const { isSyncCurrent, runSelfHeal } = await import('../core/infrastructure/self-heal')
      if (!isSyncCurrent(VERSION)) {
        await runSelfHeal(VERSION)
      }
    }
  } catch {
    // best-effort — never block the user's command on self-heal
  }
}

// v2 auto-route: if the first positional isn't a known verb, treat the
// whole argv as GTD-style inbox capture → `prjct capture "<argv>"`.
// Explicit verbs still win. Capture is zero-ceremony; if the user
// wanted a task (branch/worktree), they type `prjct task "..."`
// explicitly.
if (_fastCommand && !_binCommands.has(_fastCommand) && !REGISTERED_VERBS_SET.has(_fastCommand)) {
  const description = _fastArgs.filter((a) => !a.startsWith('-')).join(' ')
  const flags = _fastArgs.filter((a) => a.startsWith('-'))
  _fastCommand = 'capture'
  _fastArgs = ['capture', description, ...flags]
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
    } catch (err) {
      // If we successfully connected and the daemon dropped us
      // mid-response (e.g. it shut down for a code reload), the command
      // may have already had partial side effects. Falling through to
      // direct execution would re-run it — earlier this caused `ship`
      // to bump the version twice. Surface the error and let the user
      // retry instead of silently re-executing.
      const msg = (err as Error)?.message ?? ''
      if (msg.includes('Connection closed before response') || msg.includes('timed out')) {
        console.error(
          `prjct: daemon dropped the request (${msg}). Retry: \`prjct ${_fastArgs.join(' ')}\``
        )
        process.exit(1)
      }
      // Otherwise the daemon was likely never reachable (stale socket,
      // ECONNREFUSED) — fall through to normal direct execution.
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
  } else if (args[0] === 'seed') {
    // `prjct seed add|remove|list|suggest [args]` — manage active packs.
    const sub = args[1] ?? 'list'
    const rest = args
      .slice(2)
      .filter((a) => !a.startsWith('-'))
      .join(',')
    const mdMode = args.includes('--md')
    const { SeedCommands } = await import('../core/commands/seed')
    const cmd = new SeedCommands()
    let result: { success: boolean; error?: string } = { success: false, error: 'unknown' }
    if (sub === 'add') result = await cmd.add(rest || null, process.cwd(), { md: mdMode })
    else if (sub === 'remove')
      result = await cmd.remove(rest || null, process.cwd(), { md: mdMode })
    else if (sub === 'list') result = await cmd.list(null, process.cwd(), { md: mdMode })
    else if (sub === 'suggest') result = await cmd.suggest(null, process.cwd(), { md: mdMode })
    else {
      console.error(`Unknown seed subcommand: ${sub}. Use: add, remove, list, suggest.`)
    }
    process.exitCode = result.success ? 0 : 1
  } else if (args[0] === 'install') {
    // `prjct install` is a convenience alias for `prjct claude install`.
    const { InstallCommands } = await import('../core/commands/install')
    const cmd = new InstallCommands()
    const mdMode = args.includes('--md')
    const result = await cmd.install(null, process.cwd(), { md: mdMode })
    process.exitCode = result.success ? 0 : 1
  } else if (args[0] === 'claude') {
    // `prjct claude install|uninstall|status` — manage Claude Code hooks in ~/.claude/settings.json.
    const subcommand = args[1] ?? 'status'
    const { InstallCommands } = await import('../core/commands/install')
    const cmd = new InstallCommands()
    const mdMode = args.includes('--md')
    let result: Awaited<ReturnType<typeof cmd.install>> | undefined
    if (subcommand === 'install') result = await cmd.install(null, process.cwd(), { md: mdMode })
    else if (subcommand === 'uninstall')
      result = await cmd.uninstall(null, process.cwd(), { md: mdMode })
    else {
      const s = await cmd.status()
      if (s.success) {
        console.log(
          mdMode
            ? `# prjct Claude Code hooks\n\n- installed: ${s.installed}\n- expected: ${s.expected}\n`
            : `installed: ${s.installed}/${s.expected}`
        )
        result = s
      } else {
        console.error(s.error)
        result = s
      }
    }
    process.exitCode = result.success ? 0 : 1
  } else if (args[0] === 'hook') {
    // `prjct hook <name>` — runs a single Claude Code hook. Invoked by
    // the entries installed via `prjct claude install`. Reads stdin,
    // writes JSON to stdout, exits 0 even on internal failure so the
    // host session is never disturbed.
    const hookName = args[1]
    const projectPath = process.cwd()
    try {
      switch (hookName) {
        case 'session-start': {
          const { runSessionStartHook } = await import('../core/hooks/session-start')
          await runSessionStartHook(projectPath)
          break
        }
        case 'prompt': {
          const { runPromptHook } = await import('../core/hooks/prompt')
          await runPromptHook(projectPath)
          break
        }
        case 'pre-commit': {
          const { runPreCommitHook } = await import('../core/hooks/pre-commit')
          await runPreCommitHook(projectPath)
          break
        }
        case 'post-edit': {
          const { runPostEditHook } = await import('../core/hooks/post-edit')
          await runPostEditHook(projectPath)
          break
        }
        case 'stop': {
          const { runStopHook } = await import('../core/hooks/stop')
          await runStopHook(projectPath)
          break
        }
        case 'subagent-start': {
          const { runSubagentStartHook } = await import('../core/hooks/subagent-start')
          await runSubagentStartHook(projectPath)
          break
        }
        case 'cwd-changed': {
          const { runCwdChangedHook } = await import('../core/hooks/cwd-changed')
          await runCwdChangedHook(projectPath)
          break
        }
        default:
          // Unknown hook: emit empty object, stay out of the way.
          process.stdout.write('{}\n')
      }
      process.exitCode = 0
    } catch {
      process.stdout.write('{}\n')
      process.exitCode = 0
    }
  } else if (args[0] === 'crew') {
    // `prjct crew install|uninstall|status` — manage the multi-agent
    // crew bundle (leader/implementer/reviewer + CHECKPOINTS + CLAUDE.md
    // snippet). Strictly opt-in.
    const subcommand = args[1] ?? 'status'
    const { CrewCommands } = await import('../core/commands/crew')
    const cmd = new CrewCommands()
    const mdMode = args.includes('--md')
    let result: Awaited<ReturnType<typeof cmd.install>>
    if (subcommand === 'install') {
      result = await cmd.install(null, process.cwd(), { md: mdMode })
    } else if (subcommand === 'uninstall') {
      result = await cmd.uninstall(null, process.cwd(), { md: mdMode })
    } else if (subcommand === 'status') {
      result = await cmd.status(null, process.cwd(), { md: mdMode })
    } else {
      console.error(`Unknown crew subcommand: ${subcommand}. Use: install, uninstall, status.`)
      result = { success: false, error: `unknown subcommand: ${subcommand}` }
    }
    process.exitCode = result.success ? 0 : 1
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
  // Hook contract: `prjct hook <name>` must never disturb the host
  // session. If anything above the dispatcher throws (import failure,
  // unhandled rejection, corrupted config), emit the empty-JSON no-op
  // instead of the fatal banner Claude Code would surface to the user.
  if (process.argv[2] === 'hook') {
    process.stdout.write('{}\n')
    process.exit(0)
  }
  console.error('Fatal error:', (error as Error).message)
  process.exit(1)
})
