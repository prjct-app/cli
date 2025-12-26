/**
 * Server Types
 * Types for HTTP server and SSE modules.
 */

// =============================================================================
// Server Types
// =============================================================================

export interface ServerConfig {
  port: number
  host?: string
  cors?: boolean
  staticDir?: string
  apiPrefix?: string
}

export interface ServerInstance {
  start(): Promise<void>
  stop(): Promise<void>
  isRunning(): boolean
  getPort(): number
}

// =============================================================================
// SSE Types
// =============================================================================

export interface SSEClient {
  id: string
  response: unknown
  projectId?: string
}

export interface SSEManagerInterface {
  addClient(client: SSEClient): void
  removeClient(clientId: string): void
  broadcast(event: string, data: unknown): void
  sendToProject(projectId: string, event: string, data: unknown): void
}

export type SSEEventType =
  | 'connected'
  | 'session.started'
  | 'session.updated'
  | 'session.completed'
  | 'task.created'
  | 'task.updated'
  | 'feature.shipped'
  | 'sync.completed'
  | 'error'
