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
import configManager from '../infrastructure/config-manager'
import { createServer as createHttpServer, DEFAULT_PORT } from '../server/server'
import prjctDb from '../storage/database'
import type { DaemonRequest, DaemonResponse, DaemonState } from '../types/daemon'
import type { ServerInstance } from '../types/server'
import { DAEMON_PATHS, encodeMessage, IDLE_TIMEOUT_MS, MAX_BUFFER_SIZE } from './protocol'

/** Run WAL checkpoint every N requests to reclaim disk space */
const WAL_CHECKPOINT_INTERVAL = 50

let ipcServer: Server | null = null
let httpServer: ServerInstance | null = null
let commands: PrjctCommands | null = null
let state: DaemonState | null = null

/**
 * Start the daemon process
 */
export async function startDaemon(options: {
  port?: number
  noHttp?: boolean
  foreground?: boolean
}): Promise<void> {
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
    case 'status':
      return commands!.status(request.cwd, { json: opts.json === true, md })
    case 'stats':
      return commands!.stats(request.cwd, {
        json: opts.json === true,
        export: opts.export === true,
      })
    case 'diff':
      return commands!.diff(request.cwd, { json: opts.json === true, md })
    case 'seal':
      return commands!.seal(request.cwd, { json: opts.json === true })
    case 'rollback':
      return commands!.rollback(request.cwd, { json: opts.json === true, md })
    case 'verify':
      return commands!.verify(request.cwd, {
        json: opts.json === true,
        semantic: opts.semantic === true,
      })
    case 'task':
      return commands!.task(param, request.cwd, { md })
    case 'done':
      return commands!.done(request.cwd, { md })
    case 'next':
      return commands!.next(request.cwd, { md })
    case 'pause':
      return commands!.pause(param || '', request.cwd, { md })
    case 'resume':
      return commands!.resume(param, request.cwd, { md })
    case 'bug':
      return commands!.bug(param || '', request.cwd, { md })
    case 'idea':
      return commands!.idea(param || '', request.cwd, { md })
    case 'ship':
      return commands!.ship(param, request.cwd, { md })
    case 'dash':
      return commands!.dash(param || 'default', request.cwd, { md })
    case 'workflow':
      return commands!.workflowPrefs(param, request.cwd, { md })
    case 'sessions':
      return commands!.sessions(request.cwd, { md, cleanup: opts.cleanup === true })
    case 'design':
      return commands!.design(param || '', opts, request.cwd)
    case 'analysis-payload':
      return commands!.analysisPayload(request.cwd, { json: opts.json === true, md })
    case 'analysis-save-llm':
      return commands!.saveLlmAnalysis(param || '', request.cwd, { md })
    case 'analysis-llm':
      return commands!.getLlmAnalysis(request.cwd, { json: opts.json === true, md })
    case 'analyze':
      return commands!.analyze(opts, request.cwd)
    case 'cleanup':
      return commands!.cleanup(opts, request.cwd)
    case 'cleanup-projects':
      return commands!.cleanupProjects({ dryRun: opts['dry-run'] === true, md })
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
