/**
 * REST API Routes for prjct-cli
 *
 * Provides endpoints for reading and managing project state.
 *
 * @version 1.0.0
 */

import { Hono } from 'hono'
import fs from 'fs/promises'
import path from 'path'
import * as jsonc from 'jsonc-parser'
import pathManager from '../infrastructure/path-manager'
import { isNotFoundError } from '../types/fs'

// Storage paths relative to project data directory
const STORAGE_PATHS = {
  state: 'storage/state.json',
  queue: 'storage/queue.json',
  ideas: 'storage/ideas.json',
  shipped: 'storage/shipped.json',
  roadmap: 'planning/roadmap.json',
}

/**
 * Read JSON file with JSONC support
 */
async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const errors: jsonc.ParseError[] = []
    const result = jsonc.parse(content, errors)
    return errors.length > 0 ? null : result
  } catch (error) {
    // ENOENT or parse error - expected for new projects
    if (!isNotFoundError(error) && !(error instanceof SyntaxError)) {
      console.error(`JSON read error: ${(error as Error).message}`)
    }
    return null
  }
}

/**
 * Write JSON file
 */
async function writeJsonFile(filePath: string, data: unknown): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    return true
  } catch (error) {
    console.error(`JSON write error: ${(error as Error).message}`)
    return false
  }
}

/**
 * Get global project path
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
    const data = await readJsonFile(path.join(dataPath, STORAGE_PATHS.state))
    if (!data) {
      return c.json({ currentTask: null, lastUpdated: '' })
    }
    return c.json(data)
  })

  // GET /queue - Task queue
  api.get('/queue', async (c) => {
    const data = await readJsonFile(path.join(dataPath, STORAGE_PATHS.queue))
    if (!data) {
      return c.json({ tasks: [], lastUpdated: '' })
    }
    return c.json(data)
  })

  // GET /ideas - Ideas backlog
  api.get('/ideas', async (c) => {
    const data = await readJsonFile(path.join(dataPath, STORAGE_PATHS.ideas))
    if (!data) {
      return c.json({ ideas: [], lastUpdated: '' })
    }
    return c.json(data)
  })

  // GET /roadmap - Feature roadmap
  api.get('/roadmap', async (c) => {
    const data = await readJsonFile(path.join(dataPath, STORAGE_PATHS.roadmap))
    if (!data) {
      return c.json({ features: [], backlog: [], lastUpdated: '' })
    }
    return c.json(data)
  })

  // GET /shipped - Shipped items
  api.get('/shipped', async (c) => {
    const data = await readJsonFile(path.join(dataPath, STORAGE_PATHS.shipped))
    if (!data) {
      return c.json({ items: [], lastUpdated: '' })
    }
    return c.json(data)
  })

  // GET /dashboard - Combined dashboard data
  api.get('/dashboard', async (c) => {
    const [state, queue, ideas, roadmap, shipped] = await Promise.all([
      readJsonFile(path.join(dataPath, STORAGE_PATHS.state)),
      readJsonFile(path.join(dataPath, STORAGE_PATHS.queue)),
      readJsonFile(path.join(dataPath, STORAGE_PATHS.ideas)),
      readJsonFile(path.join(dataPath, STORAGE_PATHS.roadmap)),
      readJsonFile(path.join(dataPath, STORAGE_PATHS.shipped)),
    ])

    return c.json({
      projectId,
      state: state || { currentTask: null, lastUpdated: '' },
      queue: queue || { tasks: [], lastUpdated: '' },
      ideas: ideas || { ideas: [], lastUpdated: '' },
      roadmap: roadmap || { features: [], backlog: [], lastUpdated: '' },
      shipped: shipped || { items: [], lastUpdated: '' },
      timestamp: new Date().toISOString(),
    })
  })

  // POST /state - Update state (for future use)
  api.post('/state', async (c) => {
    try {
      const body = await c.req.json()
      const filePath = path.join(dataPath, STORAGE_PATHS.state)
      const success = await writeJsonFile(filePath, body)
      if (success) {
        return c.json({ success: true })
      }
      return c.json({ success: false, error: 'Failed to write' }, 500)
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
        console.error(`Context read error: ${(error as Error).message}`)
      }
      return c.text('', 200, { 'Content-Type': 'text/markdown' })
    }
  })

  return api
}
