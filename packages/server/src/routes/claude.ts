/**
 * Claude Code CLI Routes
 *
 * REST API for PTY session management.
 * WebSocket is handled in index.ts
 */

import { Hono } from 'hono'
import { ptyManager } from '../services/pty-manager'

const app = new Hono()

/**
 * GET /api/claude/status - Check Claude Code availability
 */
app.get('/status', async (c) => {
  const { execSync } = await import('child_process')

  try {
    const version = execSync('claude --version', { encoding: 'utf-8' }).trim()
    return c.json({
      success: true,
      data: {
        available: true,
        version,
        message: 'Claude Code CLI is available'
      }
    })
  } catch {
    return c.json({
      success: true,
      data: {
        available: false,
        version: null,
        message: 'Claude Code CLI not found. Install from claude.ai/code'
      }
    })
  }
})

/**
 * GET /api/claude/sessions - List active PTY sessions
 */
app.get('/sessions', (c) => {
  const sessions = ptyManager.getAllSessions().map(s => ({
    id: s.id,
    projectDir: s.projectDir,
    createdAt: s.createdAt,
    lastActivity: s.lastActivity
  }))

  return c.json({ success: true, data: sessions })
})

/**
 * POST /api/claude/sessions - Create new PTY session
 */
app.post('/sessions', async (c) => {
  const body = await c.req.json()
  const { sessionId, projectDir } = body

  if (!sessionId || !projectDir) {
    return c.json({ success: false, error: 'sessionId and projectDir required' }, 400)
  }

  try {
    const session = ptyManager.createSession(sessionId, projectDir)
    return c.json({
      success: true,
      data: {
        id: session.id,
        projectDir: session.projectDir,
        createdAt: session.createdAt,
        wsUrl: `/ws/claude/${session.id}`
      }
    }, 201)
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create session' }, 500)
  }
})

/**
 * DELETE /api/claude/sessions/:id - Kill PTY session
 */
app.delete('/sessions/:id', (c) => {
  const sessionId = c.req.param('id')
  const killed = ptyManager.kill(sessionId)

  if (killed) {
    return c.json({ success: true, message: 'Session terminated' })
  } else {
    return c.json({ success: false, error: 'Session not found' }, 404)
  }
})

export { app as claudeRoutes }
