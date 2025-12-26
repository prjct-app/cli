/**
 * Event Types
 * Types for the event system and sync events.
 */

// =============================================================================
// Sync Event Types
// =============================================================================

/**
 * Event for synchronization with backend
 */
export interface SyncEvent {
  type: string
  path: string[]
  data: unknown
  timestamp: string
  projectId: string
}

/**
 * Event type union for sync events
 */
export type SyncEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.completed'
  | 'task.deleted'
  | 'feature.created'
  | 'feature.updated'
  | 'feature.shipped'
  | 'feature.deleted'
  | 'idea.created'
  | 'idea.updated'
  | 'idea.deleted'
  | 'session.started'
  | 'session.completed'
  | 'shipped.created'
  | 'agent.created'
  | 'agent.updated'
  | 'agent.deleted'
  | 'project.updated'
