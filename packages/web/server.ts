/**
 * Custom Next.js server with WebSocket support for PTY
 *
 * PTY sessions are managed here (not in API routes) to share memory context
 */

import { createServer } from 'http'
import next from 'next'
import { WebSocketServer, WebSocket } from 'ws'
import * as pty from 'node-pty'
import type { IPty } from 'node-pty'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '9472', 10)

// PTY Sessions stored in server memory
interface Session {
  pty: IPty
  projectDir: string
  createdAt: Date
  hasStartedClaude: boolean  // Track if claude command was sent
}

const sessions = new Map<string, Session>()

function createSession(sessionId: string, projectDir: string): { pty: IPty; isNew: boolean } {
  const existing = sessions.get(sessionId)

  // If session exists for this project, reuse it (allows multiple tabs)
  if (existing) {
    console.log(`[PTY] Reusing existing session: ${sessionId}`)
    return { pty: existing.pty, isNew: false }
  }

  const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash'
  const args = process.platform === 'win32' ? [] : ['-l']

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: projectDir,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    }
  })

  sessions.set(sessionId, {
    pty: ptyProcess,
    projectDir,
    createdAt: new Date(),
    hasStartedClaude: false
  })

  // NOTE: Don't auto-start claude here - let the WebSocket handler do it
  // once the client is connected and ready to receive output

  return { pty: ptyProcess, isNew: true }
}

function getSession(sessionId: string): IPty | null {
  return sessions.get(sessionId)?.pty || null
}

function killSession(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (session) {
    try { session.pty.kill() } catch {}
    sessions.delete(sessionId)
  }
}

function resizeSession(sessionId: string, cols: number, rows: number): void {
  const session = sessions.get(sessionId)
  if (session) {
    try { session.pty.resize(cols, rows) } catch {}
  }
}

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`)

    // Handle session creation directly in server (bypasses API route isolation)
    if (url.pathname === '/api/claude/sessions' && req.method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const { sessionId, projectDir } = JSON.parse(body)
          if (!sessionId || !projectDir) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: 'sessionId and projectDir required' }))
            return
          }

          const { isNew } = createSession(sessionId, projectDir)
          console.log(`[PTY] ${isNew ? 'Created' : 'Reusing'} session: ${sessionId} for ${projectDir}`)

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, data: { sessionId, projectDir, isNew } }))
        } catch (err) {
          console.error('[PTY] Error creating session:', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'Failed to create session' }))
        }
      })
      return
    }

    // Handle session list
    if (url.pathname === '/api/claude/sessions' && req.method === 'GET') {
      const list = Array.from(sessions.entries()).map(([id, s]) => ({
        sessionId: id,
        projectDir: s.projectDir,
        createdAt: s.createdAt
      }))
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ success: true, data: list }))
      return
    }

    // All other requests go to Next.js
    try {
      await handle(req, res)
    } catch (err) {
      console.error('Error handling request:', err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  })

  // WebSocket server for PTY communication
  const wss = new WebSocketServer({ noServer: true })

  // Heartbeat interval to detect dead connections (30 seconds)
  const HEARTBEAT_INTERVAL = 30000

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const extWs = ws as WebSocket & { isAlive?: boolean; sessionId?: string }
      if (extWs.isAlive === false) {
        console.log(`[WS] Terminating dead connection: ${extWs.sessionId}`)
        if (extWs.sessionId) {
          killSession(extWs.sessionId)
        }
        return ws.terminate()
      }
      extWs.isAlive = false
      ws.ping()
    })
  }, HEARTBEAT_INTERVAL)

  // Cleanup on server close
  wss.on('close', () => {
    clearInterval(heartbeatInterval)
  })

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`)

    if (url.pathname.startsWith('/ws/claude/')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    }
    // Other upgrades (HMR) pass through to Next.js
  })

  wss.on('connection', (ws: WebSocket, request) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`)
    const sessionId = url.pathname.replace('/ws/claude/', '')

    console.log(`[WS] New PTY connection for session: ${sessionId}`)

    // Mark connection as alive and store sessionId for heartbeat
    const extWs = ws as WebSocket & { isAlive?: boolean; sessionId?: string }
    extWs.isAlive = true
    extWs.sessionId = sessionId

    // Handle pong response
    ws.on('pong', () => {
      extWs.isAlive = true
    })

    const session = sessions.get(sessionId)

    if (!session) {
      console.log(`[WS] Session not found: ${sessionId}`)
      ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }))
      ws.close()
      return
    }

    const ptyProcess = session.pty

    // Register data handler FIRST before sending any commands
    const dataHandler = ptyProcess.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }))
      }
    })

    ws.send(JSON.stringify({ type: 'connected', sessionId }))

    // Auto-start Claude CLI only once, when first client connects
    if (!session.hasStartedClaude) {
      session.hasStartedClaude = true
      console.log(`[WS] Starting Claude CLI for session: ${sessionId}`)
      setTimeout(() => {
        ptyProcess.write('claude\r')
      }, 200)  // Small delay to ensure client is ready
    }

    const exitHandler = ptyProcess.onExit(({ exitCode }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', code: exitCode }))
      }
      killSession(sessionId)
    })

    ws.on('message', (message: Buffer) => {
      try {
        const { type, data, cols, rows } = JSON.parse(message.toString())
        switch (type) {
          case 'input':
            ptyProcess?.write(data)
            break
          case 'resize':
            if (cols && rows) resizeSession(sessionId, cols, rows)
            break
        }
      } catch (err) {
        console.error('[WS] Error:', err)
      }
    })

    ws.on('close', () => {
      console.log(`[WS] PTY connection closed: ${sessionId}`)
      dataHandler.dispose()
      exitHandler.dispose()
    })

    ws.on('error', (error) => {
      console.error(`[WS] Error for ${sessionId}:`, error)
    })
  })

  server.listen(port, () => {
    console.log(`> prjct ready on http://${hostname}:${port}`)
  })
})
