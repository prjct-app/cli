/**
 * Session Manager
 * Manages temporal fragmentation of logs and progress data.
 *
 * @module infrastructure/session-manager
 * @version 0.2.1
 */

export type {
  SessionEntry,
  SessionMetadata,
  SessionStats,
  MigrationResult,
  SessionInfo,
} from './types'

export { migrateLegacyJsonl, migrateLegacyMarkdown } from './migration'
export { SessionManager } from './session-manager'

import { SessionManager } from './session-manager'

const sessionManager = new SessionManager()
export default sessionManager
