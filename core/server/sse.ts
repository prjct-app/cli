/**
 * Server-Sent Events (SSE) Manager
 *
 * Handles real-time updates to connected clients.
 * Broadcasts state changes, task updates, and notifications.
 *
 * @version 2.0.0
 */

import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { SSEClient, SSEInternalClient, SSEManager } from '../types/server'

/** Maximum client connection lifetime in ms (1 hour) */
const MAX_CLIENT_TTL_MS = 60 * 60 * 1000

/** Reaper interval in ms (5 minutes) */
const REAPER_INTERVAL_MS = 5 * 60 * 1000

/** Heartbeat interval in ms (30 seconds) */
const HEARTBEAT_INTERVAL_MS = 30_000

/**
 * Create an SSE manager for handling real-time connections
 */
export function createSSEManager(): SSEManager {
  const clients = new Map<string, SSEInternalClient>()
  let reaperInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Single cleanup function — all disconnect paths go through here.
   * Safe to call multiple times for the same clientId.
   */
  function removeClient(clientId: string): void {
    const entry = clients.get(clientId)
    if (!entry) return

    clearInterval(entry.heartbeatInterval)
    clearTimeout(entry.ttlTimeout)
    entry.abortController.abort()
    clients.delete(clientId)
  }

  /** Periodic reaper that removes zombie clients */
  function startReaper(): void {
    if (reaperInterval) return

    reaperInterval = setInterval(() => {
      const now = Date.now()
      for (const [id, entry] of clients) {
        const connectedMs = now - new Date(entry.client.connectedAt).getTime()
        if (connectedMs > MAX_CLIENT_TTL_MS) {
          removeClient(id)
        }
      }
    }, REAPER_INTERVAL_MS)

    // Don't block process exit
    if (reaperInterval && typeof reaperInterval === 'object' && 'unref' in reaperInterval) {
      reaperInterval.unref()
    }
  }

  function stopReaper(): void {
    if (reaperInterval) {
      clearInterval(reaperInterval)
      reaperInterval = null
    }
  }

  startReaper()

  return {
    /**
     * Handle a new SSE connection
     */
    handleConnection(c: Context) {
      return streamSSE(c, async (stream) => {
        const clientId = crypto.randomUUID()
        const connectedAt = new Date().toISOString()
        const abortController = new AbortController()

        // Register client
        const client: SSEClient = {
          id: clientId,
          connectedAt,
          send: (event, data) => {
            stream.writeSSE({
              event,
              data: JSON.stringify(data),
            })
          },
          close: () => {
            removeClient(clientId)
          },
        }

        // Heartbeat — detects dead connections
        const heartbeatInterval = setInterval(async () => {
          try {
            await stream.writeSSE({
              event: 'heartbeat',
              data: JSON.stringify({ timestamp: new Date().toISOString() }),
            })
          } catch {
            removeClient(clientId)
          }
        }, HEARTBEAT_INTERVAL_MS)

        // TTL — force-disconnect after max lifetime
        const ttlTimeout = setTimeout(() => {
          removeClient(clientId)
        }, MAX_CLIENT_TTL_MS)

        // Don't block process exit
        if (typeof heartbeatInterval === 'object' && 'unref' in heartbeatInterval) {
          heartbeatInterval.unref()
        }
        if (typeof ttlTimeout === 'object' && 'unref' in ttlTimeout) {
          ttlTimeout.unref()
        }

        clients.set(clientId, {
          client,
          heartbeatInterval,
          ttlTimeout,
          abortController,
        } as SSEInternalClient)

        // Send initial connection event
        await stream.writeSSE({
          event: 'connected',
          data: JSON.stringify({
            clientId,
            timestamp: connectedAt,
            message: 'Connected to prjct-cli server',
          }),
        })

        // Handle stream abort (graceful disconnect)
        stream.onAbort(() => {
          removeClient(clientId)
        })

        // Wait until abort signal fires instead of infinite promise
        await new Promise<void>((resolve) => {
          abortController.signal.addEventListener('abort', () => resolve(), { once: true })
        })
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

      for (const [id, entry] of clients) {
        try {
          entry.client.send(event, message)
        } catch {
          removeClient(id)
        }
      }
    },

    /**
     * Get current connected client count
     */
    getClientCount() {
      return clients.size
    },

    /**
     * Shut down all clients and stop the reaper.
     * Called on server stop.
     */
    shutdown() {
      stopReaper()
      for (const id of [...clients.keys()]) {
        removeClient(id)
      }
    },
  }
}
