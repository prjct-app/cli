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
// Log session types
export type {
  MigrationResult,
  Session,
  SessionEntry,
  SessionLogMetadata,
  SessionMetrics,
  SessionStats,
  TimelineEvent,
} from '../types'
export { SessionLogManager } from './session-log-manager'

// Main exports
export { TaskSessionManager } from './task-session-manager'
export { calculateDuration, formatDuration, generateId } from './utils'

// Default: TaskSessionManager for backward compatibility
import { TaskSessionManager } from './task-session-manager'
export default TaskSessionManager

// Alias for backward compatibility
export { TaskSessionManager as SessionManager } from './task-session-manager'
