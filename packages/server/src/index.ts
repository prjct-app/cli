/**
 * @prjct/server - Web Server for prjct
 *
 * Hono-based server with:
 * - REST API for project/session management
 * - WebSocket for real-time Claude Code CLI interaction
 * - SSE for live updates
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { WebSocketServer } from 'ws'
import type { IncomingMessage } from 'http'

import { projectRoutes } from './routes/projects'
import { sessionRoutes } from './routes/sessions'
import { claudeRoutes } from './routes/claude'
import { eventsRoutes } from './routes/events'
import { statsRoutes } from './routes/stats'
import { ptyManager } from './services/pty-manager'

const app = new Hono()

// Middleware
app.use('*', cors())
app.use('*', logger())

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'prjct-server',
    version: '0.1.0',
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

app.get('/health', (c) => {
  return c.json({ status: 'healthy' })
})

// API Routes
app.route('/api/projects', projectRoutes)
app.route('/api/sessions', sessionRoutes)
app.route('/api/claude', claudeRoutes)
app.route('/api/events', eventsRoutes)
app.route('/api/stats', statsRoutes)

// Start server - Use high port to avoid conflicts with dev servers
const port = parseInt(process.env.PRJCT_PORT || '9471', 10)

console.log(`
╔═══════════════════════════════════════════════╗
║                                               ║
║   ⚡ prjct server                              ║
║                                               ║
║   API:     http://localhost:${port}            ║
║   Claude:  ws://localhost:${port}/ws/claude    ║
║                                               ║
╚═══════════════════════════════════════════════╝
`)

const server = serve({
  fetch: app.fetch,
  port
})

// WebSocket Server for Claude CLI
const wss = new WebSocketServer({ noServer: true })

// Handle WebSocket upgrade
server.on('upgrade', (request: IncomingMessage, socket, head) => {
  const url = request.url || ''

  // Only handle /ws/claude/:sessionId
  if (url.startsWith('/ws/claude/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      const sessionId = url.replace('/ws/claude/', '')
      handleClaudeWebSocket(ws, sessionId)
    })
  } else {
    socket.destroy()
  }
})

function handleClaudeWebSocket(ws: any, sessionId: string) {
  const session = ptyManager.getSession(sessionId)

  if (!session) {
    ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }))
    ws.close()
    return
  }

  console.log(`[WS] Connected: ${sessionId}`)

  // Send welcome
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId,
    message: 'Connected to Claude Code CLI'
  }))

  // Forward PTY output to WebSocket
  const outputHandler = ({ sessionId: sid, data }: { sessionId: string; data: string }) => {
    if (sid === sessionId && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }))
    }
  }

  const exitHandler = ({ sessionId: sid, exitCode }: { sessionId: string; exitCode: number }) => {
    if (sid === sessionId && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }))
      ws.close()
    }
  }

  ptyManager.on('output', outputHandler)
  ptyManager.on('exit', exitHandler)

  // Handle messages from client
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString())

      switch (message.type) {
        case 'input':
          ptyManager.write(sessionId, message.data)
          break
        case 'resize':
          ptyManager.resize(sessionId, message.cols, message.rows)
          break
      }
    } catch (error) {
      console.error('[WS] Message error:', error)
    }
  })

  // Cleanup on close
  ws.on('close', () => {
    console.log(`[WS] Disconnected: ${sessionId}`)
    ptyManager.off('output', outputHandler)
    ptyManager.off('exit', exitHandler)
  })

  ws.on('error', (error: Error) => {
    console.error(`[WS] Error: ${sessionId}`, error.message)
  })
}

export { app }
