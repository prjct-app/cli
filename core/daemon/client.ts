/**
 * Daemon Client
 *
 * Thin client that connects to the daemon over Unix socket.
 * Used by the CLI entry point to route commands through the daemon
 * for near-zero startup latency.
 *
 * Falls back to direct execution if the daemon is not running.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import { connect } from 'node:net'
import { isBunAvailable } from '../utils/runtime'
import {
  DAEMON_PATHS,
  type DaemonRequest,
  type DaemonResponse,
  type DaemonStatus,
  encodeMessage,
} from './protocol'

/**
 * Check if the daemon is running (socket file exists + responds to ping)
 */
export async function isDaemonRunning(): Promise<boolean> {
  const socketPath = DAEMON_PATHS.socket()

  // Quick check: socket file exists?
  if (!fs.existsSync(socketPath)) return false

  // Verify: can we actually connect and get a response?
  try {
    const response = await sendRequest({
      id: crypto.randomUUID(),
      command: '__ping',
      args: [],
      options: {},
      cwd: process.cwd(),
    })
    return response.success
  } catch {
    // Socket exists but daemon is dead — stale socket
    try {
      fs.unlinkSync(socketPath)
    } catch {
      /* ignore */
    }
    return false
  }
}

/**
 * Get daemon status
 */
export async function getDaemonStatus(): Promise<DaemonStatus> {
  const socketPath = DAEMON_PATHS.socket()
  const pidPath = DAEMON_PATHS.pid()

  if (!fs.existsSync(socketPath)) {
    return { running: false }
  }

  try {
    const response = await sendRequest({
      id: crypto.randomUUID(),
      command: 'daemon',
      args: ['status'],
      options: {},
      cwd: process.cwd(),
    })

    if (response.success && response.result) {
      return response.result as DaemonStatus
    }
  } catch {
    // Daemon not responding
  }

  // Check PID file as fallback
  if (fs.existsSync(pidPath)) {
    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10)
    return { running: false, pid, socketPath }
  }

  return { running: false }
}

/**
 * Send a command to the daemon and return the response
 */
export function sendRequest(request: DaemonRequest): Promise<DaemonResponse> {
  return new Promise((resolve, reject) => {
    const socketPath = DAEMON_PATHS.socket()
    const socket = connect(socketPath)
    let buffer = ''
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        socket.destroy()
        reject(new Error('Daemon request timed out'))
      }
    }, 30_000) // 30s timeout for command execution

    socket.on('connect', () => {
      socket.write(encodeMessage(request))
    })

    socket.on('data', (chunk) => {
      buffer += chunk.toString()

      const newlineIdx = buffer.indexOf('\n')
      if (newlineIdx !== -1) {
        const line = buffer.slice(0, newlineIdx)
        buffer = buffer.slice(newlineIdx + 1)

        try {
          const response = JSON.parse(line) as DaemonResponse
          resolved = true
          clearTimeout(timeout)
          socket.end()
          resolve(response)
        } catch (err) {
          resolved = true
          clearTimeout(timeout)
          socket.end()
          reject(new Error(`Invalid daemon response: ${(err as Error).message}`))
        }
      }
    })

    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        reject(err)
      }
    })

    socket.on('close', () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        reject(new Error('Connection closed before response'))
      }
    })
  })
}

/**
 * Execute a CLI command via the daemon
 *
 * Returns the DaemonResponse, or null if the daemon is not available
 * (caller should fall back to direct execution).
 *
 * When autoStart is true and the daemon is not running, spawns it
 * in the background so the next command gets the fast path.
 */
export async function executeViaDaemon(
  command: string,
  args: string[],
  options: Record<string, string | boolean>,
  cwd: string,
  perfStartNs?: string,
  autoStart = true
): Promise<DaemonResponse | null> {
  const socketPath = DAEMON_PATHS.socket()

  if (!fs.existsSync(socketPath)) {
    if (autoStart) {
      // Spawn daemon in background for future commands
      spawnDaemon().catch(() => {})
    }
    return null // Daemon not running — fall back for this command
  }

  try {
    return await sendRequest({
      id: crypto.randomUUID(),
      command,
      args,
      options,
      cwd,
      perfStartNs,
    })
  } catch {
    return null // Daemon error — fall back
  }
}

/**
 * Request the daemon to stop
 */
export async function stopDaemon(): Promise<boolean> {
  try {
    const response = await sendRequest({
      id: crypto.randomUUID(),
      command: 'daemon',
      args: ['stop'],
      options: {},
      cwd: process.cwd(),
    })
    return response.success
  } catch {
    return false
  }
}

/**
 * Force-kill the daemon using PID file when graceful stop fails.
 * Cleans up socket and PID files afterward.
 */
export function forceKillDaemon(): boolean {
  const pidPath = DAEMON_PATHS.pid()
  const socketPath = DAEMON_PATHS.socket()

  let killed = false

  // Try to kill via PID file
  if (fs.existsSync(pidPath)) {
    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10)
    if (!Number.isNaN(pid)) {
      try {
        process.kill(pid, 'SIGKILL')
        killed = true
      } catch {
        // Process already dead
      }
    }
  }

  // Clean up stale files
  try {
    if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath)
  } catch {
    /* ignore */
  }
  try {
    if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath)
  } catch {
    /* ignore */
  }

  return killed
}

/**
 * Spawn the daemon as a background process
 *
 * Resolves entry point following the same pattern as bin/prjct.ts:
 * - Dev mode: raw TypeScript via bun (core/daemon/entry.ts exists)
 * - Production (from dist/bin/): compiled JS adjacent (../daemon/entry.mjs)
 * - Production (from bin/): compiled JS in dist/ (dist/daemon/entry.mjs)
 */
export async function spawnDaemon(): Promise<boolean> {
  const { spawn } = await import('node:child_process')
  const path = await import('node:path')

  // Resolve daemon entry: prefer source (dev) → compiled (production)
  const srcPath = path.join(__dirname, 'entry.ts')
  // When running from dist/bin/, the daemon is at ../daemon/entry.mjs
  const distPathAdjacent = path.join(__dirname, '..', 'daemon', 'entry.mjs')
  // When running from bin/, the daemon is at dist/daemon/entry.mjs
  const distPath = path.join(__dirname, '..', 'dist', 'daemon', 'entry.mjs')

  let entryPath: string
  let runtime: string

  if (fs.existsSync(srcPath)) {
    // Dev mode: use raw TypeScript with bun
    entryPath = srcPath
    runtime = 'bun'
  } else if (fs.existsSync(distPathAdjacent)) {
    // Production (running from dist/): prefer bun if available
    entryPath = distPathAdjacent
    runtime = isBunAvailable() ? 'bun' : 'node'
  } else if (fs.existsSync(distPath)) {
    // Production (running from bin/): prefer bun if available
    entryPath = distPath
    runtime = isBunAvailable() ? 'bun' : 'node'
  } else {
    return false
  }

  const runDir = DAEMON_PATHS.runDir()
  fs.mkdirSync(runDir, { recursive: true })

  const logPath = DAEMON_PATHS.log()
  const logFd = fs.openSync(logPath, 'a')

  const child = spawn(runtime, [entryPath], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, PRJCT_DAEMON: '1' },
  })

  child.unref()
  fs.closeSync(logFd)

  // Poll until daemon is live (up to 3s, especially important after updates)
  const deadline = Date.now() + 3000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    if (await isDaemonRunning()) return true
  }

  return false
}
