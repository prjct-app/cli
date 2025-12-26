export interface SyncEvent {
  type: string
  path: string[]
  data: unknown
  timestamp: string
  projectId: string
}

export type EventType =
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

