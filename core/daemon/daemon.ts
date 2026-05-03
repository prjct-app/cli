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
import prjctDb from '../storage/database'
import type { DaemonRequest, DaemonResponse, DaemonState } from '../types/daemon'
import { executeCommand } from './dispatch'
import { DAEMON_PATHS, encodeMessage, IDLE_TIMEOUT_MS, MAX_BUFFER_SIZE } from './protocol'
import {
  isCodeStale as detectStaleCode,
  isGlobalVersionDrifted,
  isProcessRunning,
  readOwnPackageVersion,
  resolveEntryPath,
  rotateLog,
} from './staleness'

/** Run WAL checkpoint every N requests to reclaim disk space */
const WAL_CHECKPOINT_INTERVAL = 50

/** Re-check global install version every N requests (cheap readlink+readFile) */
const VERSION_DRIFT_CHECK_INTERVAL = 10

let ipcServer: Server | null = null
let commands: PrjctCommands | null = null
let state: DaemonState | null = null
let ownVersion: string | null = null

export async function startDaemon(options: { foreground?: boolean }): Promise<void> {
  // Flag child services (wiki-generator etc.) can check to know they're
  // running under the long-lived daemon — lets them fire-and-forget safe
  // work that would otherwise be killed by `process.exit()` in the CLI.
  process.env.PRJCT_IN_DAEMON = '1'

  const socketPath = DAEMON_PATHS.socket()
  const pidPath = DAEMON_PATHS.pid()
  const runDir = DAEMON_PATHS.runDir()

  fs.mkdirSync(runDir, { recursive: true })

  // Check if daemon is already running
  if (fs.existsSync(pidPath)) {
    const existingPid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10)
    if (isProcessRunning(existingPid)) {
      console.error(`Daemon already running (PID ${existingPid})`)
      process.exit(1)
    }
    fs.unlinkSync(pidPath)
  }

  // Clean up stale socket
  if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath)

  rotateLog()

  const entryPath = resolveEntryPath()
  let entryMtime: number | null = null
  if (entryPath) {
    try {
      entryMtime = fs.statSync(entryPath).mtimeMs
    } catch {
      // Can't stat — skip stale detection
    }
  }

  ownVersion = readOwnPackageVersion()

  state = {
    startedAt: Date.now(),
    commandsServed: 0,
    lastActivity: Date.now(),
    idleTimeoutMs: IDLE_TIMEOUT_MS,
    idleTimer: null,
    entryPath,
    entryMtime,
    activeRequests: 0,
    restartPending: false,
  }

  // Self-heal hooks + global CLAUDE.md when the binary moved past the
  // last sync. Best-effort: failures must never block daemon startup.
  if (ownVersion) {
    try {
      const { isSyncCurrent, runSelfHeal } = await import('../infrastructure/self-heal')
      if (!isSyncCurrent(ownVersion)) await runSelfHeal(ownVersion)
    } catch {
      // never block daemon startup
    }
  }

  // Pre-load modules (this is the whole point — do it once)
  commands = new PrjctCommands()

  ipcServer = createNetServer((socket) => handleConnection(socket))

  ipcServer.listen(socketPath, () => {
    fs.chmodSync(socketPath, 0o600)
    fs.writeFileSync(pidPath, String(process.pid))

    console.log(`prjct daemon started (PID ${process.pid})`)
    console.log(`  Socket: ${socketPath}`)
    if (entryPath) console.log(`  Watching: ${entryPath}`)

    resetIdleTimer()
  })

  ipcServer.on('error', (err) => {
    console.error('Daemon socket error:', err.message)
    shutdown(1)
  })

  process.on('SIGTERM', () => shutdown(0))
  process.on('SIGINT', () => shutdown(0))
  process.on('SIGHUP', () => {
    commands = new PrjctCommands()
    console.log('Daemon reloaded (SIGHUP)')
  })

  if (!options.foreground) {
    try {
      process.stdin?.unref?.()
    } catch {
      // Not available in all runtimes (e.g. Bun)
    }
  }
}

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

async function handleRequest(request: DaemonRequest): Promise<DaemonResponse> {
  if (!state || !commands) {
    return {
      id: request.id,
      success: false,
      exitCode: 1,
      stderr: 'Daemon not initialized',
    }
  }

  // If we already decided to restart, refuse new work so the client
  // takes the direct path on its first try (instead of getting a
  // dropped socket mid-request and falling through silently).
  if (state.restartPending) {
    return {
      id: request.id,
      success: false,
      exitCode: 1,
      stderr: 'Daemon restarting — retry the command',
    }
  }

  state.activeRequests++
  try {
    return await handleRequestInner(request)
  } finally {
    state.activeRequests--
    if (state.restartPending && state.activeRequests === 0) {
      console.log('Daemon shutting down for code reload...')
      // Defer to next tick so the response finishes flushing to the client.
      setImmediate(() => shutdown(0))
    }
  }
}

async function handleRequestInner(request: DaemonRequest): Promise<DaemonResponse> {
  if (!state || !commands) {
    return {
      id: request.id,
      success: false,
      exitCode: 1,
      stderr: 'Daemon not initialized',
    }
  }

  resetIdleTimer()
  state.commandsServed++
  state.lastActivity = Date.now()

  if (state.commandsServed % WAL_CHECKPOINT_INTERVAL === 0) {
    prjctDb.checkpointAll()
  }

  // Stale-code detection: check if the entry file was rebuilt. Mark
  // restart as pending and let the request finish.
  if (!state.restartPending && detectStaleCode(state.entryPath, state.entryMtime)) {
    console.log('Build changed detected — daemon will restart after this request')
    state.restartPending = true
  }

  // Global-install drift detection: catches pnpm content-store upgrades
  // where the old daemon's files are untouched but the user-facing `prjct`
  // binary now points at a different version.
  if (
    !state.restartPending &&
    ownVersion &&
    state.commandsServed % VERSION_DRIFT_CHECK_INTERVAL === 0 &&
    isGlobalVersionDrifted(ownVersion)
  ) {
    console.log(
      `Version drift detected — daemon v${ownVersion} is stale; shutting down so the next request spawns fresh.`
    )
    state.restartPending = true
  }

  if (request.command === 'daemon') return handleDaemonCommand(request)

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
      const result = await executeCommand(commands, request)
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
        stale: state ? detectStaleCode(state.entryPath, state.entryMtime) : false,
      },
    }
  }

  if (subcommand === 'stop') {
    const response: DaemonResponse = {
      id: request.id,
      success: true,
      exitCode: 0,
      stdout: 'Daemon stopping...',
    }
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

function resetIdleTimer(): void {
  if (!state) return

  if (state.idleTimer) clearTimeout(state.idleTimer)

  state.idleTimer = setTimeout(() => {
    console.log(`Daemon idle for ${state!.idleTimeoutMs / 1000 / 60} minutes, shutting down`)
    shutdown(0)
  }, state.idleTimeoutMs)

  // Don't keep the process alive just for the timer
  if (state.idleTimer.unref) state.idleTimer.unref()
}

function shutdown(exitCode: number): void {
  console.log('Daemon shutting down...')

  if (state?.idleTimer) clearTimeout(state.idleTimer)

  if (ipcServer) {
    ipcServer.close()
    ipcServer = null
  }

  prjctDb.close()

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
