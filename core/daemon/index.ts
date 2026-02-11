/**
 * Daemon module exports
 */

export {
  executeViaDaemon,
  getDaemonStatus,
  isDaemonRunning,
  spawnDaemon,
  stopDaemon,
} from './client'
export { shutdown, startDaemon } from './daemon'
export type { DaemonRequest, DaemonResponse, DaemonStatus } from './protocol'
export { DAEMON_PATHS, IDLE_TIMEOUT_MS } from './protocol'
