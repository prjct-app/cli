/**
 * Server-Sent Events (SSE) Manager
 *
 * Handles real-time updates to connected clients.
 * Broadcasts state changes, task updates, and notifications.
 *
 * @version 1.0.0
 */

import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { SSEClient, SSEManager } from '../types'

/**
 * Create an SSE manager for handling real-time connections
 */
export function createSSEManager(): SSEManager {
  const clients = new Map<string, SSEClient>()

  return {
    /**
     * Handle a new SSE connection
     */
    handleConnection(c: Context) {
      return streamSSE(c, async (stream) => {
        const clientId = crypto.randomUUID()

        // Register client
        const client: SSEClient = {
          id: clientId,
          send: (event, data) => {
            stream.writeSSE({
              event,
              data: JSON.stringify(data),
            })
          },
          close: () => {
            clients.delete(clientId)
          },
        }

        clients.set(clientId, client)

        // Send initial connection event
        await stream.writeSSE({
          event: 'connected',
          data: JSON.stringify({
            clientId,
            timestamp: new Date().toISOString(),
            message: 'Connected to prjct-cli server',
          }),
        })

        // Keep connection alive with heartbeat
        const heartbeat = setInterval(async () => {
          try {
            await stream.writeSSE({
              event: 'heartbeat',
              data: JSON.stringify({ timestamp: new Date().toISOString() }),
            })
          } catch {
            clearInterval(heartbeat)
            clients.delete(clientId)
          }
        }, 30000) // Every 30 seconds

        // Handle disconnect
        stream.onAbort(() => {
          clearInterval(heartbeat)
          clients.delete(clientId)
        })

        // Keep stream open indefinitely
        await new Promise(() => {})
      })
    },

    /**
     * Broadcast an event to all connected clients
     */
    broadcast(event: string, data: unknown) {
      const message = {
        event,
        data,
        timestamp: new Date().toISOString(),
      }

      for (const client of clients.values()) {
        try {
          client.send(event, message)
        } catch {
          // Client disconnected, will be cleaned up
          clients.delete(client.id)
        }
      }
    },

    /**
     * Get current connected client count
     */
    getClientCount() {
      return clients.size
    },
  }
}

/**
 * Event types for SSE broadcasts
 */
export const SSE_EVENTS = {
  // Task events
  TASK_STARTED: 'task:started',
  TASK_COMPLETED: 'task:completed',
  TASK_PAUSED: 'task:paused',
  TASK_RESUMED: 'task:resumed',

  // Feature events
  FEATURE_CREATED: 'feature:created',
  FEATURE_SHIPPED: 'feature:shipped',

  // Idea events
  IDEA_CAPTURED: 'idea:captured',
  IDEA_CONVERTED: 'idea:converted',

  // State events
  STATE_UPDATED: 'state:updated',
  QUEUE_UPDATED: 'queue:updated',

  // System events
  CONNECTED: 'connected',
  HEARTBEAT: 'heartbeat',
  ERROR: 'error',
} as const

export type SSEEventType = (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS]
