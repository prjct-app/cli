/**
 * Event Bus Types
 *
 * Types for the lightweight Pub/Sub system
 */

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
  ALL: '*'
} as const

export type EventType = typeof EventTypes[keyof typeof EventTypes]

export interface EventData {
  type: string
  timestamp: string
  projectId: string | null
  [key: string]: unknown
}

export type EventCallback = (data: EventData) => void | Promise<void>

