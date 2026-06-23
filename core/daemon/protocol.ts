/**
 * Daemon IPC Protocol
 *
 * Runtime constants and codec functions for the JSON message format
 * exchanged between the thin CLI client and the daemon process.
 *
 * Protocol: newline-delimited JSON (NDJSON) over a local IPC endpoint.
 * macOS/Linux use Unix domain sockets; Windows uses a named pipe.
 */

import crypto from 'node:crypto'
import path from 'node:path'
import { resolveCliHome } from '../infrastructure/cli-home'
import type { DaemonRequest, DaemonResponse } from '../types/daemon'

const WINDOWS_PIPE_PREFIX = '\\\\.\\pipe\\'

export function getDaemonRunDir(cliHome: string = resolveCliHome()): string {
  return path.join(cliHome, 'run')
}

export function getDaemonSocketPath(
  platform: NodeJS.Platform = process.platform,
  cliHome: string = resolveCliHome()
): string {
  if (platform === 'win32') {
    const id = crypto.createHash('sha1').update(path.resolve(cliHome)).digest('hex').slice(0, 16)
    return `${WINDOWS_PIPE_PREFIX}prjct-${id}-daemon`
  }
  return path.join(getDaemonRunDir(cliHome), 'daemon.sock')
}

export function isDaemonNamedPipe(socketPath: string = getDaemonSocketPath()): boolean {
  return socketPath.startsWith(WINDOWS_PIPE_PREFIX)
}

/** Paths used by the daemon */
export const DAEMON_PATHS = {
  /** Directory for runtime files */
  runDir: () => getDaemonRunDir(),
  /** Local IPC endpoint: Unix socket on POSIX, named pipe on Windows */
  socket: () => getDaemonSocketPath(),
  /** PID file */
  pid: () => path.join(DAEMON_PATHS.runDir(), 'daemon.pid'),
  /** Log file */
  log: () => path.join(DAEMON_PATHS.runDir(), 'daemon.log'),
}

/** Default idle timeout before auto-shutdown (30 minutes) */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000

/** Maximum buffer size per connection before rejecting (1 MB) */
export const MAX_BUFFER_SIZE = 1024 * 1024

/** Encode a message for sending over socket */
export function encodeMessage(msg: DaemonRequest | DaemonResponse): Buffer {
  return Buffer.from(`${JSON.stringify(msg)}\n`)
}
