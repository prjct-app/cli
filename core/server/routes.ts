/**
 * REST API Routes for prjct-cli
 *
 * Provides endpoints for reading and managing project state.
 * All storage reads/writes go through SQLite via storage APIs.
 *
 * @version 2.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { Hono } from 'hono'
import pathManager from '../infrastructure/path-manager'
import { prjctDb } from '../storage/database'
import { ideasStorage } from '../storage/ideas-storage'
import { queueStorage } from '../storage/queue-storage'
import { shippedStorage } from '../storage/shipped-storage'
import { stateStorage } from '../storage/state-storage'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import log from '../utils/logger'

/**
 * Get global project path (still needed for context MD file reads)
 */
function getProjectDataPath(projectId: string): string {
  return pathManager.getGlobalProjectPath(projectId)
}

/**
 * Create API routes for a project
 */
export function createRoutes(projectId: string, _projectPath: string): Hono {
  const api = new Hono()
  const dataPath = getProjectDataPath(projectId)

  // GET /state - Current task state
  api.get('/state', async (c) => {
    const data = await stateStorage.read(projectId)
    return c.json(data)
  })

  // GET /queue - Task queue
  api.get('/queue', async (c) => {
    const data = await queueStorage.read(projectId)
    return c.json(data)
  })

  // GET /ideas - Ideas backlog
  api.get('/ideas', async (c) => {
    const data = await ideasStorage.read(projectId)
    return c.json(data)
  })

  // GET /roadmap - Feature roadmap
  api.get('/roadmap', async (c) => {
    const data = prjctDb.getDoc(projectId, 'roadmap')
    if (!data) {
      return c.json({ features: [], backlog: [], lastUpdated: '' })
    }
    return c.json(data)
  })

  // GET /shipped - Shipped items
  api.get('/shipped', async (c) => {
    const data = await shippedStorage.read(projectId)
    return c.json(data)
  })

  // GET /dashboard - Combined dashboard data
  api.get('/dashboard', async (c) => {
    const [state, queue, ideas, shipped] = await Promise.all([
      stateStorage.read(projectId),
      queueStorage.read(projectId),
      ideasStorage.read(projectId),
      shippedStorage.read(projectId),
    ])
    const roadmap = prjctDb.getDoc(projectId, 'roadmap')

    return c.json({
      projectId,
      state,
      queue,
      ideas,
      roadmap: roadmap || { features: [], backlog: [], lastUpdated: '' },
      shipped,
      timestamp: new Date().toISOString(),
    })
  })

  // POST /state - Update state (for future use)
  api.post('/state', async (c) => {
    try {
      const body = await c.req.json()
      await stateStorage.write(projectId, body)
      return c.json({ success: true })
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 400)
    }
  })

  // GET /context - Read context markdown files
  api.get('/context/:name', async (c) => {
    const name = c.req.param('name')
    const allowedFiles = ['now', 'next', 'ideas', 'shipped']

    if (!allowedFiles.includes(name)) {
      return c.json({ error: 'Invalid context file' }, 400)
    }

    try {
      const filePath = path.join(dataPath, 'context', `${name}.md`)
      const content = await fs.readFile(filePath, 'utf-8')
      return c.text(content, 200, { 'Content-Type': 'text/markdown' })
    } catch (error) {
      // ENOENT - context file doesn't exist yet (expected)
      if (!isNotFoundError(error)) {
        log.error(`Context read error: ${getErrorMessage(error)}`)
      }
      return c.text('', 200, { 'Content-Type': 'text/markdown' })
    }
  })

  return api
}
