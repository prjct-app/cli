/**
 * Events Routes - Server-Sent Events for real-time updates
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

const app = new Hono()

// Store connected clients by project
const clients = new Map<string, Set<(data: string) => void>>()

/**
 * Broadcast event to all clients watching a project
 */
export function broadcastEvent(projectId: string, event: object) {
  const projectClients = clients.get(projectId)
  if (!projectClients) return

  const data = JSON.stringify(event)
  for (const send of projectClients) {
    send(data)
  }
}

/**
 * GET /api/events - SSE stream for project events
 */
app.get('/', async (c) => {
  const projectId = c.req.query('projectId')

  if (!projectId) {
    return c.json({ success: false, error: 'projectId required' }, 400)
  }

  return streamSSE(c, async (stream) => {
    // Register client
    if (!clients.has(projectId)) {
      clients.set(projectId, new Set())
    }

    const send = (data: string) => {
      stream.writeSSE({ data })
    }

    clients.get(projectId)!.add(send)

    // Send initial connection event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({
        projectId,
        timestamp: new Date().toISOString()
      })
    })

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ timestamp: new Date().toISOString() })
        })
      } catch {
        clearInterval(heartbeat)
      }
    }, 30000)

    // Wait for disconnect
    try {
      await new Promise((resolve) => {
        stream.onAbort(() => {
          resolve(null)
        })
      })
    } finally {
      clearInterval(heartbeat)
      clients.get(projectId)?.delete(send)
    }
  })
})

/**
 * POST /api/events - Emit an event
 */
app.post('/', async (c) => {
  const body = await c.req.json()
  const { projectId, event } = body

  if (!projectId || !event) {
    return c.json({ success: false, error: 'projectId and event required' }, 400)
  }

  broadcastEvent(projectId, {
    ...event,
    timestamp: new Date().toISOString()
  })

  return c.json({ success: true })
})

export { app as eventsRoutes }
