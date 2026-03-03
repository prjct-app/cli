/**
 * Session Types
 * Types for session management and logging.
 */

// =============================================================================
// Core Session Types
// =============================================================================

/**
 * Session record with full tracking information.
 */
export interface Session {
  id: string
  projectId: string
  task: string
  status: 'active' | 'paused' | 'completed'
  startedAt: string
  endedAt?: string
  pausedAt: string | null
  completedAt: string | null
  duration: number
  metrics: SessionMetrics
  timeline: TimelineEvent[]
}

/**
 * Session metrics for tracking work done.
 */
export interface SessionMetrics {
  filesCreated: number
  filesChanged: number
  filesModified: number
  linesAdded: number
  linesRemoved: number
  commits: number
  snapshots: string[]
}

/**
 * Timeline event for session history.
 */
export interface TimelineEvent {
  type: 'start' | 'pause' | 'resume' | 'complete'
  at: string
}

// =============================================================================
// Session Log Types
// =============================================================================

/**
 * Entry in session log file.
 */
export interface SessionEntry {
  timestamp?: string
  data?: {
    timestamp?: string
  }
  _sessionDate?: Date
  [key: string]: unknown
}

/**
 * Metadata for a session log file.
 */
export interface SessionLogMetadata {
  created?: string
  lastActivity?: string
  entryCount?: number
  shipCount?: number
  version?: string
  migrated?: boolean
  migratedAt?: string
}

/**
 * Statistics across all sessions.
 */
export interface SessionStats {
  totalSessions: number
  activeDays: number
  totalEntries: number
  totalShips: number
  averageEntriesPerDay: number
}

/**
 * Result from session migration.
 */
export interface SessionMigrationResult {
  success: boolean
  message: string
  entriesMigrated: number
  sessionsCreated?: number
}

/**
 * Session file information.
 */
export interface SessionInfo {
  path: string
  date: Date
  year: string
  month: string
  day: string
}

// =============================================================================
// Context Compaction Types
// =============================================================================

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  tokens?: number
}

export interface CompactedContext {
  summary: string
  keyPoints: string[]
  decisions: string[]
  filesModified: string[]
  tasksCompleted: string[]
  originalTurns: number
  compactedAt: string
}

export interface CompactionConfig {
  maxTurns?: number
  maxTokens?: number
  preserveRecent?: number
  summaryMaxLength?: number
}

/** Enhanced compacted context with structured file references and code flows */
export interface TruthSnapshot extends CompactedContext {
  fileReferences: Array<{
    path: string
    lineRange?: string
    role: 'modified' | 'read' | 'created' | 'test'
  }>
  codeFlows: Array<{
    description: string
    files: string[]
  }>
  testResults: Array<{
    file: string
    status: 'pass' | 'fail' | 'skip'
    summary: string
  }>
  currentState: {
    branch: string
    uncommittedFiles: string[]
    taskDescription: string | null
  }
  format: 'truth_snapshot'
  version: 1
}
