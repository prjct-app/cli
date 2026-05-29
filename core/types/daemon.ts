/**
 * Daemon IPC Protocol Types
 *
 * Type definitions for the JSON messages exchanged between the thin CLI client
 * and the daemon process over a Unix socket.
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
  /** Raw stdin payload, forwarded for `hook` commands (the Claude Code
   *  event JSON the hook would otherwise read from its own stdin). */
  stdin?: string
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
  /** Number of requests currently being processed. Restart waits for this to hit 0. */
  activeRequests: number
  /** True once the daemon has decided to restart; new requests are refused. */
  restartPending: boolean
}
