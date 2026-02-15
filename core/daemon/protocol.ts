/**
 * Daemon IPC Protocol
 *
 * Defines the JSON message format exchanged between the thin CLI client
 * and the daemon process over a Unix socket.
 *
 * Protocol: newline-delimited JSON (NDJSON) over Unix domain socket.
 * Each message is a single JSON object terminated by \n.
 */

/** Request sent from CLI client to daemon */
export interface DaemonRequest {
  /** Unique request ID for correlating responses */
  id: string
  /** CLI command name (e.g. "sync", "status", "done") */
  command: string
  /** Positional arguments */
  args: string[]
  /** Named options/flags */
  options: Record<string, string | boolean>
  /** Working directory of the CLI client */
  cwd: string
  /** Process start time (nanoseconds) for startup metrics */
  perfStartNs?: string
}

/** Response sent from daemon to CLI client */
export interface DaemonResponse {
  /** Correlates to request ID */
  id: string
  /** Whether the command succeeded */
  success: boolean
  /** Exit code to use */
  exitCode: number
  /** Stdout output to display */
  stdout?: string
  /** Stderr output to display */
  stderr?: string
  /** Structured result (for --json mode) */
  result?: unknown
}

/** Daemon status info returned by `daemon status` */
export interface DaemonStatus {
  running: boolean
  pid?: number
  socketPath?: string
  uptime?: number
  commandsServed?: number
  lastActivity?: string
}

/** Internal daemon state */
export interface DaemonState {
  startedAt: number
  commandsServed: number
  lastActivity: number
  idleTimeoutMs: number
  idleTimer: ReturnType<typeof setTimeout> | null
  /** Path to the entry file used to start the daemon */
  entryPath: string | null
  /** mtime of the entry file at daemon startup (ms since epoch) */
  entryMtime: number | null
}

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

/** Encode a message for sending over socket */
export function encodeMessage(msg: DaemonRequest | DaemonResponse): Buffer {
  return Buffer.from(`${JSON.stringify(msg)}\n`)
}

/** Decode a message received from socket */
export function decodeMessage(data: string): DaemonRequest | DaemonResponse {
  return JSON.parse(data.trim())
}
