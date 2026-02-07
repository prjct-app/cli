/**
 * Server Types
 * Types for HTTP server and SSE modules.
 */

import type { Context, Hono } from 'hono'

// =============================================================================
// Server Types
// =============================================================================

export type ServerHandle = { stop: () => void } | null

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
  connectedAt: string
  send: (event: string, data: unknown) => void
  close: () => void
}

export interface SSEInternalClient {
  client: SSEClient
  heartbeatInterval: ReturnType<typeof setInterval>
  ttlTimeout: ReturnType<typeof setTimeout>
  abortController: AbortController
}

export interface SSEManager {
  handleConnection: (c: Context) => Response
  broadcast: (event: string, data: unknown) => void
  getClientCount: () => number
  shutdown: () => void
}

export const SSE_EVENTS = {
  TASK_STARTED: 'task:started',
  TASK_COMPLETED: 'task:completed',
  TASK_PAUSED: 'task:paused',
  TASK_RESUMED: 'task:resumed',
  FEATURE_CREATED: 'feature:created',
  FEATURE_SHIPPED: 'feature:shipped',
  IDEA_CAPTURED: 'idea:captured',
  IDEA_CONVERTED: 'idea:converted',
  STATE_UPDATED: 'state:updated',
  QUEUE_UPDATED: 'queue:updated',
  CONNECTED: 'connected',
  HEARTBEAT: 'heartbeat',
  ERROR: 'error',
} as const

export type SSEEventType = (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS]
