/**
 * Server Types
 * Types for HTTP server and SSE modules.
 */

import type { Hono } from 'hono'

// =============================================================================
// Server Types
// =============================================================================

export interface ServerConfig {
  port: number
  host?: string
  projectId: string
  projectPath: string
  enableCors?: boolean
  enableLogging?: boolean
}

export interface ServerInstance {
  app: Hono
  start: () => Promise<void>
  stop: () => void
  broadcast: (event: string, data: unknown) => void
}

// =============================================================================
// SSE Types
// =============================================================================

export interface SSEClient {
  id: string
  send: (event: string, data: unknown) => void
  close: () => void
}

export interface SSEManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleConnection: (c: any) => Response
  broadcast: (event: string, data: unknown) => void
  getClientCount: () => number
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
