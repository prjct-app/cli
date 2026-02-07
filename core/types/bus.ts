/**
 * Event Bus Types
 * Types for the lightweight Pub/Sub system.
 */

// =============================================================================
// Event Types Constant
// =============================================================================

/**
 * Event Types - All events that can be emitted
 */
export const EventTypes = {
  // Session events
  SESSION_STARTED: 'session.started',
  SESSION_PAUSED: 'session.paused',
  SESSION_RESUMED: 'session.resumed',
  SESSION_COMPLETED: 'session.completed',

  // Task events
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  TASK_UPDATED: 'task.updated',

  // Feature events
  FEATURE_ADDED: 'feature.added',
  FEATURE_SHIPPED: 'feature.shipped',
  FEATURE_UPDATED: 'feature.updated',

  // Idea events
  IDEA_CAPTURED: 'idea.captured',
  IDEA_PROMOTED: 'idea.promoted',

  // Snapshot events
  SNAPSHOT_CREATED: 'snapshot.created',
  SNAPSHOT_RESTORED: 'snapshot.restored',

  // Git events
  COMMIT_CREATED: 'git.commit',
  PUSH_COMPLETED: 'git.push',

  // System events
  PROJECT_INITIALIZED: 'project.init',
  PROJECT_SYNCED: 'project.sync',
  ANALYSIS_COMPLETED: 'analysis.completed',

  // Wildcard
  ALL: '*',
} as const

// =============================================================================
// Bus Types
// =============================================================================

/**
 * Event type union derived from EventTypes
 */
export type BusEventType = (typeof EventTypes)[keyof typeof EventTypes]

/**
 * Event data payload (base interface for all events)
 */
export interface EventData {
  type: string
  timestamp: string
  projectId: string | null
  [key: string]: unknown
}

// =============================================================================
// Typed Event Payloads
// =============================================================================

export interface SessionStartedPayload {
  sessionId: string
  task: unknown
  projectId: string | null
}

export interface SessionPausedPayload {
  sessionId: string
  task: unknown
  duration: number
  projectId: string | null
}

export interface SessionResumedPayload {
  sessionId: string
  task: unknown
  projectId: string | null
}

export interface SessionCompletedPayload {
  sessionId: string
  task: unknown
  duration: number
  metrics: unknown
  projectId: string | null
}

export interface TaskCreatedPayload {
  taskId: string
  description: string
  [key: string]: unknown
}

export interface TaskCompletedPayload {
  taskId: string
  [key: string]: unknown
}

export interface FeaturePayload {
  [key: string]: unknown
}

export interface IdeaCapturedPayload {
  [key: string]: unknown
}

export interface SnapshotCreatedPayload {
  hash: string
  message: string
  timestamp: string
  filesCount: number
  projectId: string | null
}

export interface SnapshotRestoredPayload {
  hash: string
  filesCount: number
  timestamp: string
  projectId: string | null
}

export interface GitCommitPayload {
  [key: string]: unknown
}

export interface GitPushPayload {
  [key: string]: unknown
}

export interface ProjectInitializedPayload {
  [key: string]: unknown
}

export interface ProjectSyncedPayload {
  [key: string]: unknown
}

export interface AnalysisCompletedPayload {
  [key: string]: unknown
}

/**
 * Maps event type strings to their typed payloads
 */
export interface EventMap {
  [EventTypes.SESSION_STARTED]: SessionStartedPayload
  [EventTypes.SESSION_PAUSED]: SessionPausedPayload
  [EventTypes.SESSION_RESUMED]: SessionResumedPayload
  [EventTypes.SESSION_COMPLETED]: SessionCompletedPayload
  [EventTypes.TASK_CREATED]: TaskCreatedPayload
  [EventTypes.TASK_COMPLETED]: TaskCompletedPayload
  [EventTypes.TASK_UPDATED]: Record<string, unknown>
  [EventTypes.FEATURE_ADDED]: FeaturePayload
  [EventTypes.FEATURE_SHIPPED]: FeaturePayload
  [EventTypes.FEATURE_UPDATED]: FeaturePayload
  [EventTypes.IDEA_CAPTURED]: IdeaCapturedPayload
  [EventTypes.IDEA_PROMOTED]: Record<string, unknown>
  [EventTypes.SNAPSHOT_CREATED]: SnapshotCreatedPayload
  [EventTypes.SNAPSHOT_RESTORED]: SnapshotRestoredPayload
  [EventTypes.COMMIT_CREATED]: GitCommitPayload
  [EventTypes.PUSH_COMPLETED]: GitPushPayload
  [EventTypes.PROJECT_INITIALIZED]: ProjectInitializedPayload
  [EventTypes.PROJECT_SYNCED]: ProjectSyncedPayload
  [EventTypes.ANALYSIS_COMPLETED]: AnalysisCompletedPayload
  [EventTypes.ALL]: Record<string, unknown>
}

/**
 * Event callback handler
 */
export type EventCallback = (data: EventData) => void | Promise<void>

/**
 * Event subscription
 */
export interface EventSubscription {
  id: string
  type: BusEventType
  callback: EventCallback
}
