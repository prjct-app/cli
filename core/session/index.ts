/**
 * SessionManager - Structured Session Tracking
 *
 * Tracks work sessions with metrics, timeline, and duration.
 * Inspired by OpenCode's session system but simplified.
 *
 * Storage: ~/.prjct-cli/projects/{projectId}/sessions/
 *
 * @version 1.0.0
 */

export type { Session, SessionMetrics, TimelineEvent } from './types'
export { generateId, calculateDuration, formatDuration } from './utils'
export { SessionManager } from './session-manager'

import { SessionManager } from './session-manager'
export default SessionManager
