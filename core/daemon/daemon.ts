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
import { PrjctCommands } from '../commands/index'
import { commandRegistry } from '../commands/registry'
import '../commands/register'
import configManager from '../infrastructure/config-manager'
import { createServer as createHttpServer, DEFAULT_PORT } from '../server/server'
import type { ServerInstance } from '../types'
import {
  DAEMON_PATHS,
  type DaemonRequest,
  type DaemonResponse,
  type DaemonState,
  encodeMessage,
  IDLE_TIMEOUT_MS,
} from './protocol'

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

  // Initialize state
  state = {
    startedAt: Date.now(),
    commandsServed: 0,
    lastActivity: Date.now(),
    idleTimeoutMs: IDLE_TIMEOUT_MS,
    idleTimer: null,
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
async function executeCommand(request: DaemonRequest): Promise<import('../types').CommandResult> {
  const param = request.args.join(' ') || null
  const opts = request.options

  // Commands that need options routed through PrjctCommands
  switch (request.command) {
    case 'sync':
      return commands!.sync(request.cwd, {
        aiTools: opts.agents ? String(opts.agents).split(',') : undefined,
        preview: opts.preview === true || opts['dry-run'] === true,
        yes: opts.yes === true,
        json: opts.json === true,
        package: opts.package ? String(opts.package) : undefined,
        full: opts.full === true,
      })
    case 'status':
      return commands!.status(request.cwd, { json: opts.json === true })
    case 'stats':
      return commands!.stats(request.cwd, {
        json: opts.json === true,
        export: opts.export === true,
      })
    case 'seal':
      return commands!.seal(request.cwd, { json: opts.json === true })
    case 'verify':
      return commands!.verify(request.cwd, {
        json: opts.json === true,
        semantic: opts.semantic === true,
      })
    case 'design':
      return commands!.design(param || '', opts)
    case 'analyze':
      return commands!.analyze(opts)
    case 'cleanup':
      return commands!.cleanup(opts)
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
