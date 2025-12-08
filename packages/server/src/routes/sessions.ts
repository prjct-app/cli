/**
 * Session Routes
 */

import { Hono } from 'hono'
import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { generateSessionId, getTimestamp } from '@prjct/shared'

const app = new Hono()

const GLOBAL_STORAGE = join(homedir(), '.prjct-cli', 'projects')

/**
 * GET /api/sessions - List sessions for a project
 */
app.get('/', async (c) => {
  const projectId = c.req.query('projectId')
  if (!projectId) {
    return c.json({ success: false, error: 'projectId required' }, 400)
  }

  const archivePath = join(GLOBAL_STORAGE, projectId, 'sessions', 'archive')
  const sessions = []

  try {
    const months = await fs.readdir(archivePath)

    for (const month of months.sort().reverse()) {
      const monthPath = join(archivePath, month)
      const files = await fs.readdir(monthPath)

      for (const file of files.sort().reverse()) {
        if (!file.endsWith('.json')) continue

        const content = await fs.readFile(join(monthPath, file), 'utf-8')
        sessions.push(JSON.parse(content))

        if (sessions.length >= 20) break
      }

      if (sessions.length >= 20) break
    }
  } catch {
    // No archive yet
  }

  return c.json({ success: true, data: sessions })
})

/**
 * GET /api/sessions/current - Get current session
 */
app.get('/current', async (c) => {
  const projectId = c.req.query('projectId')
  if (!projectId) {
    return c.json({ success: false, error: 'projectId required' }, 400)
  }

  const sessionPath = join(GLOBAL_STORAGE, projectId, 'sessions', 'current.json')

  try {
    const content = await fs.readFile(sessionPath, 'utf-8')
    const session = JSON.parse(content)
    return c.json({ success: true, data: session })
  } catch {
    return c.json({ success: true, data: null })
  }
})

/**
 * POST /api/sessions - Create new session
 */
app.post('/', async (c) => {
  const body = await c.req.json()
  const { projectId, task } = body

  if (!projectId || !task) {
    return c.json({ success: false, error: 'projectId and task required' }, 400)
  }

  const sessionPath = join(GLOBAL_STORAGE, projectId, 'sessions', 'current.json')

  // Check for existing session
  try {
    const existing = await fs.readFile(sessionPath, 'utf-8')
    const session = JSON.parse(existing)
    if (session.status === 'active') {
      return c.json({
        success: false,
        error: `Session already active: ${session.task}`
      }, 409)
    }
  } catch {
    // No existing session
  }

  const now = getTimestamp()
  const session = {
    id: generateSessionId(),
    projectId,
    task,
    status: 'active',
    startedAt: now,
    pausedAt: null,
    completedAt: null,
    duration: 0,
    metrics: {
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0,
      commits: 0,
      snapshots: []
    },
    timeline: [{ type: 'start', at: now }]
  }

  await fs.mkdir(join(GLOBAL_STORAGE, projectId, 'sessions'), { recursive: true })
  await fs.writeFile(sessionPath, JSON.stringify(session, null, 2))

  return c.json({ success: true, data: session }, 201)
})

/**
 * POST /api/sessions/:id/pause - Pause session
 */
app.post('/:id/pause', async (c) => {
  const projectId = c.req.query('projectId')
  if (!projectId) {
    return c.json({ success: false, error: 'projectId required' }, 400)
  }

  const sessionPath = join(GLOBAL_STORAGE, projectId, 'sessions', 'current.json')

  try {
    const content = await fs.readFile(sessionPath, 'utf-8')
    const session = JSON.parse(content)

    if (session.status !== 'active') {
      return c.json({ success: false, error: 'Session not active' }, 400)
    }

    const now = getTimestamp()
    session.status = 'paused'
    session.pausedAt = now
    session.timeline.push({ type: 'pause', at: now })

    // Calculate duration
    let duration = 0
    let lastStart: Date | null = null
    for (const event of session.timeline) {
      if (event.type === 'start' || event.type === 'resume') {
        lastStart = new Date(event.at)
      } else if (event.type === 'pause' && lastStart) {
        duration += (new Date(event.at).getTime() - lastStart.getTime()) / 1000
        lastStart = null
      }
    }
    session.duration = Math.round(duration)

    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2))
    return c.json({ success: true, data: session })
  } catch {
    return c.json({ success: false, error: 'Session not found' }, 404)
  }
})

/**
 * POST /api/sessions/:id/resume - Resume session
 */
app.post('/:id/resume', async (c) => {
  const projectId = c.req.query('projectId')
  if (!projectId) {
    return c.json({ success: false, error: 'projectId required' }, 400)
  }

  const sessionPath = join(GLOBAL_STORAGE, projectId, 'sessions', 'current.json')

  try {
    const content = await fs.readFile(sessionPath, 'utf-8')
    const session = JSON.parse(content)

    if (session.status !== 'paused') {
      return c.json({ success: false, error: 'Session not paused' }, 400)
    }

    const now = getTimestamp()
    session.status = 'active'
    session.pausedAt = null
    session.timeline.push({ type: 'resume', at: now })

    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2))
    return c.json({ success: true, data: session })
  } catch {
    return c.json({ success: false, error: 'Session not found' }, 404)
  }
})

/**
 * POST /api/sessions/:id/complete - Complete session
 */
app.post('/:id/complete', async (c) => {
  const projectId = c.req.query('projectId')
  if (!projectId) {
    return c.json({ success: false, error: 'projectId required' }, 400)
  }

  const sessionPath = join(GLOBAL_STORAGE, projectId, 'sessions', 'current.json')

  try {
    const content = await fs.readFile(sessionPath, 'utf-8')
    const session = JSON.parse(content)

    const now = getTimestamp()
    session.status = 'completed'
    session.completedAt = now
    session.timeline.push({ type: 'complete', at: now })

    // Calculate final duration
    let duration = 0
    let lastStart: Date | null = null
    for (const event of session.timeline) {
      if (event.type === 'start' || event.type === 'resume') {
        lastStart = new Date(event.at)
      } else if ((event.type === 'pause' || event.type === 'complete') && lastStart) {
        duration += (new Date(event.at).getTime() - lastStart.getTime()) / 1000
        lastStart = null
      }
    }
    session.duration = Math.round(duration)

    // Archive session
    const date = new Date(session.completedAt)
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const archivePath = join(GLOBAL_STORAGE, projectId, 'sessions', 'archive', yearMonth)
    await fs.mkdir(archivePath, { recursive: true })
    await fs.writeFile(join(archivePath, `${session.id}.json`), JSON.stringify(session, null, 2))

    // Clear current session
    await fs.unlink(sessionPath)

    return c.json({ success: true, data: session })
  } catch {
    return c.json({ success: false, error: 'Session not found' }, 404)
  }
})

export { app as sessionRoutes }
