/**
 * Daemon IPC Protocol
 *
 * Runtime constants and codec functions for the JSON message format
 * exchanged between the thin CLI client and the daemon process
 * over a Unix socket.
 *
 * Protocol: newline-delimited JSON (NDJSON) over Unix domain socket.
 * Each message is a single JSON object terminated by \n.
 */

import type { DaemonRequest, DaemonResponse } from '../types/daemon'

/** Paths used by the daemon */
export const DAEMON_PATHS = {
  /** Directory for runtime files */
  runDir: () => {
    const home = process.env.HOME || require('node:os').homedir()
    return `${home}/.prjct-cli/run`
  },
  /** Unix domain socket path */
  socket: () => `${DAEMON_PATHS.runDir()}/daemon.sock`,
  /** PID file */
  pid: () => `${DAEMON_PATHS.runDir()}/daemon.pid`,
  /** Log file */
  log: () => `${DAEMON_PATHS.runDir()}/daemon.log`,
}

/** Default idle timeout before auto-shutdown (30 minutes) */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000

/** Maximum buffer size per connection before rejecting (1 MB) */
export const MAX_BUFFER_SIZE = 1024 * 1024

/** Encode a message for sending over socket */
export function encodeMessage(msg: DaemonRequest | DaemonResponse): Buffer {
  return Buffer.from(`${JSON.stringify(msg)}\n`)
}

/** Decode a message received from socket */
function _decodeMessage(data: string): DaemonRequest | DaemonResponse {
  return JSON.parse(data.trim())
}
