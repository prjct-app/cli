/**
 * prjct Daemon Server
 *
 * Long-running background process that keeps CLI modules warm in memory.
 * Listens on a Unix domain socket for commands from the thin CLI client.
 *
 * Benefits:
 * - Near-zero startup (~5-10ms vs ~360ms cold start)
 * - Modules loaded once, reused across invocations
 * - Storage caches persist across commands
 * - Single process for CLI + HTTP API
 */

import fs from 'node:fs'
import type { Server, Socket } from 'node:net'
import { createServer as createNetServer } from 'node:net'
import { PrjctCommands } from '../commands/commands'
import { commandRegistry } from '../commands/registry'
import '../commands/register'
import { isRemovedVerb, migrationMessage } from '../commands/removed-verbs'
import configManager from '../infrastructure/config-manager'
import { createServer as createHttpServer, DEFAULT_PORT } from '../server/server'
import prjctDb from '../storage/database'
import type { DaemonRequest, DaemonResponse, DaemonState } from '../types/daemon'
import type { ServerInstance } from '../types/server'
import { DAEMON_PATHS, encodeMessage, IDLE_TIMEOUT_MS, MAX_BUFFER_SIZE } from './protocol'

/** Run WAL checkpoint every N requests to reclaim disk space */
const WAL_CHECKPOINT_INTERVAL = 50

/** Re-check global install version every N requests (cheap readlink+readFile) */
const VERSION_DRIFT_CHECK_INTERVAL = 10

let ipcServer: Server | null = null
let httpServer: ServerInstance | null = null
let commands: PrjctCommands | null = null
let state: DaemonState | null = null
let ownVersion: string | null = null

/**
 * Start the daemon process
 */
export async function startDaemon(options: {
  port?: number
  noHttp?: boolean
  foreground?: boolean
}): Promise<void> {
  // Flag child services (wiki-generator etc.) can check to know they're
  // running under the long-lived daemon — lets them fire-and-forget safe
  // work that would otherwise be killed by `process.exit()` in the CLI.
  process.env.PRJCT_IN_DAEMON = '1'

  const socketPath = DAEMON_PATHS.socket()
  const pidPath = DAEMON_PATHS.pid()
  const runDir = DAEMON_PATHS.runDir()

  // Ensure run directory exists
  fs.mkdirSync(runDir, { recursive: true })

  // Check if daemon is already running
  if (fs.existsSync(pidPath)) {
    const existingPid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10)
    if (isProcessRunning(existingPid)) {
      console.error(`Daemon already running (PID ${existingPid})`)
      process.exit(1)
    }
    // Stale PID file — clean up
    fs.unlinkSync(pidPath)
  }

  // Clean up stale socket
  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath)
  }

  // Rotate log if over 1 MB
  rotateLog()

  // Resolve entry file path and mtime for stale-code detection
  const entryPath = resolveEntryPath()
  let entryMtime: number | null = null
  if (entryPath) {
    try {
      entryMtime = fs.statSync(entryPath).mtimeMs
    } catch {
      // Can't stat — skip stale detection
    }
  }

  // Capture our own package version so we can detect the scenario where a
  // newer `prjct-cli` was installed globally but this long-lived daemon is
  // still serving requests from the old build. pnpm's content-addressable
  // store means `isCodeStale()` won't catch it — the old files stay put at
  // a different path. We re-probe the global binary on every request
  // (cheap) and shut ourselves down on mismatch.
  ownVersion = readOwnPackageVersion()

  // Initialize state
  state = {
    startedAt: Date.now(),
    commandsServed: 0,
    lastActivity: Date.now(),
    idleTimeoutMs: IDLE_TIMEOUT_MS,
    idleTimer: null,
    entryPath,
    entryMtime,
  }

  // Pre-load modules (this is the whole point — do it once)
  commands = new PrjctCommands()

  // Start IPC socket server
  ipcServer = createNetServer((socket) => handleConnection(socket))

  ipcServer.listen(socketPath, () => {
    // Set socket permissions (owner read/write only)
    fs.chmodSync(socketPath, 0o600)

    // Write PID file
    fs.writeFileSync(pidPath, String(process.pid))

    console.log(`prjct daemon started (PID ${process.pid})`)
    console.log(`  Socket: ${socketPath}`)
    if (entryPath) {
      console.log(`  Watching: ${entryPath}`)
    }

    // Start idle timeout
    resetIdleTimer()
  })

  ipcServer.on('error', (err) => {
    console.error('Daemon socket error:', err.message)
    shutdown(1)
  })

  // Start HTTP server (merged into daemon)
  if (!options.noHttp) {
    try {
      const projectPath = process.cwd()
      const projectId = await configManager.getProjectId(projectPath)

      if (projectId) {
        const port = options.port || DEFAULT_PORT
        httpServer = createHttpServer({
          port,
          projectId,
          projectPath,
          enableLogging: false,
        })
        await httpServer.start()
      }
    } catch {
      // HTTP server is optional — daemon works without it
    }
  }

  // Signal handlers for graceful shutdown
  process.on('SIGTERM', () => shutdown(0))
  process.on('SIGINT', () => shutdown(0))
  process.on('SIGHUP', () => {
    // Reload: re-initialize commands (picks up new registrations)
    commands = new PrjctCommands()
    console.log('Daemon reloaded (SIGHUP)')
  })

  // Keep process alive
  if (!options.foreground) {
    // Detach stdin when running as background daemon
    try {
      process.stdin?.unref?.()
    } catch {
      // Not available in all runtimes (e.g. Bun)
    }
  }
}

/**
 * Handle an incoming IPC connection
 */
function handleConnection(socket: Socket): void {
  let buffer = ''

  socket.on('data', async (chunk) => {
    buffer += chunk.toString()

    // Guard against unbounded buffer growth from malformed clients
    if (buffer.length > MAX_BUFFER_SIZE) {
      const errorResponse: DaemonResponse = {
        id: 'unknown',
        success: false,
        exitCode: 1,
        stderr: 'Request too large',
      }
      socket.write(encodeMessage(errorResponse))
      socket.destroy()
      buffer = ''
      return
    }

    // Process complete messages (newline-delimited)
    let newlineIdx: number
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx)
      buffer = buffer.slice(newlineIdx + 1)

      if (!line.trim()) continue

      try {
        const request = JSON.parse(line) as DaemonRequest
        const response = await handleRequest(request)
        socket.write(encodeMessage(response))
      } catch (err) {
        const errorResponse: DaemonResponse = {
          id: 'unknown',
          success: false,
          exitCode: 1,
          stderr: `Protocol error: ${(err as Error).message}`,
        }
        socket.write(encodeMessage(errorResponse))
      }
    }
  })

  socket.on('error', () => {
    // Client disconnected — nothing to do
  })
}

/**
 * Handle a single CLI command request
 */
async function handleRequest(request: DaemonRequest): Promise<DaemonResponse> {
  if (!state || !commands) {
    return {
      id: request.id,
      success: false,
      exitCode: 1,
      stderr: 'Daemon not initialized',
    }
  }

  // Reset idle timer on every request
  resetIdleTimer()
  state.commandsServed++
  state.lastActivity = Date.now()

  // Periodic WAL checkpoint to reclaim disk space
  if (state.commandsServed % WAL_CHECKPOINT_INTERVAL === 0) {
    prjctDb.checkpointAll()
  }

  // Stale-code detection: check if the entry file was rebuilt
  if (isCodeStale()) {
    console.log('Build changed detected — daemon will restart after this request')
    // Schedule restart after responding to this request
    setTimeout(() => {
      console.log('Daemon shutting down for code reload...')
      shutdown(0)
    }, 200)
  }

  // Global-install drift detection: catches pnpm content-store upgrades
  // where the old daemon's files are untouched but the user-facing `prjct`
  // binary now points at a different version. Mtime check above won't
  // detect that — we need a version comparison.
  if (
    ownVersion &&
    state.commandsServed % VERSION_DRIFT_CHECK_INTERVAL === 0 &&
    isGlobalVersionDrifted()
  ) {
    console.log(
      `Version drift detected — daemon v${ownVersion} is stale; shutting down so the next request spawns fresh.`
    )
    setTimeout(() => shutdown(0), 200)
  }

  // Handle daemon meta-commands
  if (request.command === 'daemon') {
    return handleDaemonCommand(request)
  }

  // Handle ping (health check from client)
  if (request.command === '__ping') {
    return {
      id: request.id,
      success: true,
      exitCode: 0,
      result: { pong: true, pid: process.pid },
    }
  }

  // Execute the CLI command
  try {
    // Capture stdout/stderr
    const output: string[] = []
    const errors: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => output.push(args.map(String).join(' '))
    console.error = (...args: unknown[]) => errors.push(args.map(String).join(' '))

    try {
      const result = await executeCommand(request)

      return {
        id: request.id,
        success: result.success,
        exitCode: result.success ? 0 : 1,
        stdout: output.join('\n') || result.message || undefined,
        stderr: errors.join('\n') || result.error || undefined,
        result,
      }
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  } catch (err) {
    return {
      id: request.id,
      success: false,
      exitCode: 1,
      stderr: (err as Error).message,
    }
  }
}

/**
 * Execute a command, routing options-dependent commands through PrjctCommands
 * (mirrors the routing in core/index.ts)
 */
async function executeCommand(
  request: DaemonRequest
): Promise<import('../types/commands').CommandResult> {
  const param = request.args.join(' ') || null
  const opts = request.options

  const md = opts.md === true

  // Short-circuit v2-removed verbs with a migration message so the daemon
  // path matches the fallback path in core/index.ts. Otherwise users get
  // a generic "Unknown command" from the registry with no migration hint.
  if (isRemovedVerb(request.command) && !commandRegistry.getByName(request.command)) {
    const msg = migrationMessage(request.command) ?? `'${request.command}' was removed in v2.`
    return { success: false, error: msg }
  }

  // Commands that need options routed through PrjctCommands
  switch (request.command) {
    case 'sync':
      return commands!.sync(request.cwd, {
        preview: opts.preview === true || opts['dry-run'] === true,
        yes: opts.yes === true,
        json: opts.json === true,
        md,
        package: opts.package ? String(opts.package) : undefined,
        full: opts.full === true,
      })
    case 'task':
      return commands!.task(param, request.cwd, { md })
    case 'ship':
      return commands!.ship(param, request.cwd, { md })
    case 'workflow':
      return commands!.workflowPrefs(param, request.cwd, { md })
    case 'analyze':
      return commands!.analyze(opts, request.cwd)
    case 'status':
      return commands!.status(param, request.cwd, { md })
    case 'tag':
      return commands!.tag(param, request.cwd, { md })
    case 'remember':
      return commands!.remember(param, request.cwd, {
        md,
        tags: opts.tags ? String(opts.tags) : undefined,
      })
    default:
      // Standard commands without special option handling
      return commandRegistry.execute(request.command, param, request.cwd)
  }
}

/**
 * Handle daemon meta-commands (status, stop)
 */
function handleDaemonCommand(request: DaemonRequest): DaemonResponse {
  const subcommand = request.args[0]

  if (subcommand === 'status') {
    return {
      id: request.id,
      success: true,
      exitCode: 0,
      result: {
        running: true,
        pid: process.pid,
        socketPath: DAEMON_PATHS.socket(),
        uptime: state ? Date.now() - state.startedAt : 0,
        commandsServed: state?.commandsServed ?? 0,
        lastActivity: state ? new Date(state.lastActivity).toISOString() : null,
        registeredCommands: commandRegistry.list().length,
        stale: isCodeStale(),
      },
    }
  }

  if (subcommand === 'stop') {
    // Respond before shutting down
    const response: DaemonResponse = {
      id: request.id,
      success: true,
      exitCode: 0,
      stdout: 'Daemon stopping...',
    }
    // Shut down after response is sent
    setTimeout(() => shutdown(0), 100)
    return response
  }

  return {
    id: request.id,
    success: false,
    exitCode: 1,
    stderr: `Unknown daemon command: ${subcommand}. Use: status, stop`,
  }
}

/**
 * Reset the idle auto-shutdown timer
 */
function resetIdleTimer(): void {
  if (!state) return

  if (state.idleTimer) {
    clearTimeout(state.idleTimer)
  }

  state.idleTimer = setTimeout(() => {
    console.log(`Daemon idle for ${state!.idleTimeoutMs / 1000 / 60} minutes, shutting down`)
    shutdown(0)
  }, state.idleTimeoutMs)

  // Don't keep the process alive just for the timer
  if (state.idleTimer.unref) {
    state.idleTimer.unref()
  }
}

/**
 * Gracefully shut down the daemon
 */
export function shutdown(exitCode: number): void {
  console.log('Daemon shutting down...')

  // Clear idle timer
  if (state?.idleTimer) {
    clearTimeout(state.idleTimer)
  }

  // Stop HTTP server
  if (httpServer) {
    httpServer.stop()
    httpServer = null
  }

  // Close IPC socket
  if (ipcServer) {
    ipcServer.close()
    ipcServer = null
  }

  // Close all database connections
  prjctDb.close()

  // Clean up files
  const socketPath = DAEMON_PATHS.socket()
  const pidPath = DAEMON_PATHS.pid()

  try {
    if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath)
  } catch {
    /* ignore */
  }

  try {
    if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath)
  } catch {
    /* ignore */
  }

  process.exit(exitCode)
}

/**
 * Check if a process with the given PID is still running
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve a build artifact path for stale-code detection.
 * Always uses dist/daemon/entry.mjs as the sentinel file since it gets
 * regenerated on every `npm run build`, regardless of whether the daemon
 * is running from source (dev/bun) or compiled (production/node).
 */
function resolveEntryPath(): string | null {
  const path = require('node:path')

  // Find the project root by looking for package.json
  let dir = __dirname
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      const sentinel = path.join(dir, 'dist', 'daemon', 'entry.mjs')
      if (fs.existsSync(sentinel)) return sentinel
      break
    }
    dir = path.dirname(dir)
  }

  // Fallback: check paths relative to this file
  const candidates = [
    path.join(__dirname, '..', 'daemon', 'entry.mjs'), // from dist/bin/
    path.join(__dirname, '..', 'dist', 'daemon', 'entry.mjs'), // from bin/
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  // Last resort: use the script being executed
  const scriptPath = process.argv[1]
  if (scriptPath && fs.existsSync(scriptPath)) return scriptPath

  return null
}

/**
 * Rotate daemon log if it exceeds 1 MB.
 * Keeps one backup (.1) and truncates the current log.
 */
const MAX_LOG_BYTES = 1024 * 1024 // 1 MB

function rotateLog(): void {
  const logPath = DAEMON_PATHS.log()
  try {
    const stat = fs.statSync(logPath)
    if (stat.size > MAX_LOG_BYTES) {
      const backupPath = `${logPath}.1`
      // Remove old backup, rename current, create fresh
      try {
        fs.unlinkSync(backupPath)
      } catch {
        /* no previous backup */
      }
      fs.renameSync(logPath, backupPath)
    }
  } catch {
    // Log file doesn't exist yet — nothing to rotate
  }
}

/**
 * Check if the daemon's entry file has been modified since startup.
 * Returns true if a rebuild was detected.
 */
function isCodeStale(): boolean {
  if (!state?.entryPath || state.entryMtime === null) return false

  try {
    const currentMtime = fs.statSync(state.entryPath).mtimeMs
    return currentMtime !== state.entryMtime
  } catch {
    return false
  }
}

/**
 * Walk up from __dirname to find this package's own package.json and return
 * its `version`. Called once at startup; cached in `ownVersion`.
 */
function readOwnPackageVersion(): string | null {
  const path = require('node:path')
  let dir = __dirname
  for (let i = 0; i < 6; i++) {
    const pkgPath = path.join(dir, 'package.json')
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      if (pkg?.name === 'prjct-cli' && typeof pkg.version === 'string') {
        return pkg.version
      }
    } catch {
      /* not here — keep walking */
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/**
 * Best-effort detection that a newer `prjct-cli` has been installed globally
 * while this daemon is still running. Returns `true` only when we can
 * positively identify a mismatch — on any lookup failure we return `false`
 * (daemon keeps running; no false positives).
 *
 * Handles the common install layouts (pnpm, npm, volta, mise, asdf) by
 * resolving the shell binary through known symlink paths and walking up to
 * its `package.json`.
 */
function isGlobalVersionDrifted(): boolean {
  if (!ownVersion) return false
  const os = require('node:os')
  const path = require('node:path')
  const home = os.homedir()

  const candidates = [
    `${home}/Library/pnpm/prjct`, // pnpm (macOS default)
    `${home}/.local/share/pnpm/prjct`, // pnpm (Linux)
    `${home}/.npm-global/bin/prjct`, // npm (custom prefix)
    '/usr/local/bin/prjct', // npm (default prefix)
    '/opt/homebrew/bin/prjct', // homebrew symlink
    `${home}/.volta/bin/prjct`, // volta
    `${home}/.asdf/shims/prjct`, // asdf
  ]

  for (const symlink of candidates) {
    let realPath: string
    try {
      realPath = fs.realpathSync(symlink)
    } catch {
      continue // not installed here
    }

    // Walk up from the resolved binary to find its package.json
    let dir = path.dirname(realPath)
    for (let i = 0; i < 6; i++) {
      const pkgPath = path.join(dir, 'package.json')
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
        if (pkg?.name === 'prjct-cli' && typeof pkg.version === 'string') {
          return pkg.version !== ownVersion
        }
      } catch {
        /* keep walking */
      }
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }

  return false // couldn't resolve any install — can't tell, assume OK
}
