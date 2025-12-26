/**
 * Session Management - Consolidated Module
 *
 * Two managers with distinct purposes:
 * - TaskSessionManager: Task lifecycle (start, pause, complete)
 * - SessionLogManager: Log fragmentation (JSONL temporal)
 *
 * Storage: ~/.prjct-cli/projects/{projectId}/sessions/
 *
 * @version 2.0.0
 */

// Task session types and utilities
export type { Session, SessionMetrics, TimelineEvent } from './types'
export { generateId, calculateDuration, formatDuration } from './utils'

// Log session types
export type { SessionEntry, SessionMetadata, SessionStats, MigrationResult } from './log-types'

// Main exports
export { TaskSessionManager } from './task-session-manager'
export { SessionLogManager } from './session-log-manager'

// Default: TaskSessionManager for backward compatibility
import { TaskSessionManager } from './task-session-manager'
export default TaskSessionManager

// Alias for backward compatibility
export { TaskSessionManager as SessionManager } from './task-session-manager'
