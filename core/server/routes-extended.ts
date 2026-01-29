/**
 * Extended REST API Routes for prjct-cli Status Bar
 *
 * New endpoints for multi-project management and quick actions.
 * These complement the existing routes in routes.ts
 *
 * @version 2.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { Hono } from 'hono'
import * as jsonc from 'jsonc-parser'
import pathManager from '../infrastructure/path-manager'
import { isNotFoundError } from '../types/fs'

// =============================================================================
// HELPERS
// =============================================================================

const GLOBAL_BASE = pathManager.getGlobalBasePath()
const PROJECTS_DIR = path.join(GLOBAL_BASE, 'projects')

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const errors: jsonc.ParseError[] = []
    const result = jsonc.parse(content, errors)
    return errors.length > 0 ? null : result
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }
    throw error
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
    return true
  } catch (error) {
    if (isNotFoundError(error)) {
      return false
    }
    throw error
  }
}

function getProjectPath(projectId: string): string {
  return path.join(PROJECTS_DIR, projectId)
}

async function getProjectConfig(projectId: string): Promise<any> {
  const configPath = path.join(getProjectPath(projectId), 'project.json')
  return await readJsonFile(configPath)
}

async function calculateDuration(startedAt: string | undefined): Promise<string> {
  if (!startedAt) return ''

  const start = new Date(startedAt)
  const now = new Date()
  const elapsed = now.getTime() - start.getTime()

  const hours = Math.floor(elapsed / (1000 * 60 * 60))
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

// =============================================================================
// ROUTES
// =============================================================================

export function createExtendedRoutes(): Hono {
  const api = new Hono()

  // -------------------------------------------------------------------------
  // GET /projects - List all projects with summary
  // -------------------------------------------------------------------------
  api.get('/projects', async (c) => {
    try {
      await fs.mkdir(PROJECTS_DIR, { recursive: true })
      const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
      const projectIds = entries.filter((e) => e.isDirectory()).map((e) => e.name)

      const projects = await Promise.all(
        projectIds.map(async (id) => {
          const projectPath = getProjectPath(id)

          // Read config
          const config = await getProjectConfig(id)

          // Read state
          const state = await readJsonFile<any>(path.join(projectPath, 'storage/state.json'))

          // Read queue for count
          const queue = await readJsonFile<any>(path.join(projectPath, 'storage/queue.json'))

          // Read ideas for count
          const ideas = await readJsonFile<any>(path.join(projectPath, 'storage/ideas.json'))

          // Read shipped for count
          const shipped = await readJsonFile<any>(path.join(projectPath, 'storage/shipped.json'))

          const currentTask = state?.currentTask
          const duration = await calculateDuration(currentTask?.startedAt)

          return {
            id,
            name: config?.name || id.slice(0, 8),
            path: config?.path || null,
            currentTask: currentTask
              ? {
                  ...currentTask,
                  duration,
                }
              : null,
            pausedTask: state?.previousTask || null,
            stats: {
              queueCount: queue?.tasks?.filter((t: any) => !t.completed)?.length || 0,
              ideasCount: ideas?.ideas?.filter((i: any) => i.status === 'pending')?.length || 0,
              shippedCount: shipped?.shipped?.length || 0,
            },
          }
        })
      )

      // Sort: active projects first, then by name
      projects.sort((a, b) => {
        if (a.currentTask && !b.currentTask) return -1
        if (!a.currentTask && b.currentTask) return 1
        return (a.name || '').localeCompare(b.name || '')
      })

      return c.json({ projects })
    } catch (error) {
      return c.json({ projects: [], error: String(error) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // GET /projects/:id/full - Complete project dashboard
  // -------------------------------------------------------------------------
  api.get('/projects/:id/full', async (c) => {
    const projectId = c.req.param('id')
    const projectPath = getProjectPath(projectId)

    try {
      const [config, state, queue, ideas, shipped, roadmap] = await Promise.all([
        getProjectConfig(projectId),
        readJsonFile<any>(path.join(projectPath, 'storage/state.json')),
        readJsonFile<any>(path.join(projectPath, 'storage/queue.json')),
        readJsonFile<any>(path.join(projectPath, 'storage/ideas.json')),
        readJsonFile<any>(path.join(projectPath, 'storage/shipped.json')),
        readJsonFile<any>(path.join(projectPath, 'planning/roadmap.json')),
      ])

      // Calculate current task duration
      if (state?.currentTask?.startedAt) {
        state.currentTask.duration = await calculateDuration(state.currentTask.startedAt)
      }

      // Calculate stats
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(todayStart)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())

      const completedToday =
        queue?.tasks?.filter((t: any) => {
          if (!t.completed || !t.completedAt) return false
          return new Date(t.completedAt) >= todayStart
        })?.length || 0

      const completedThisWeek =
        queue?.tasks?.filter((t: any) => {
          if (!t.completed || !t.completedAt) return false
          return new Date(t.completedAt) >= weekStart
        })?.length || 0

      return c.json({
        id: projectId,
        name: config?.name || projectId,
        path: config?.path,
        state: state || { currentTask: null, previousTask: null, lastUpdated: '' },
        queue: queue || { tasks: [], lastUpdated: '' },
        ideas: ideas || { ideas: [], lastUpdated: '' },
        shipped: shipped || { shipped: [], lastUpdated: '' },
        roadmap: roadmap || { features: [], backlog: [], lastUpdated: '' },
        stats: {
          tasksToday: completedToday,
          tasksThisWeek: completedThisWeek,
          queueCount: queue?.tasks?.filter((t: any) => !t.completed)?.length || 0,
          ideasCount: ideas?.ideas?.filter((i: any) => i.status === 'pending')?.length || 0,
          shippedCount: shipped?.shipped?.length || 0,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      return c.json({ error: String(error) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // POST /projects/:id/task/complete - Complete current task
  // -------------------------------------------------------------------------
  api.post('/projects/:id/task/complete', async (c) => {
    const projectId = c.req.param('id')
    const projectPath = getProjectPath(projectId)
    const statePath = path.join(projectPath, 'storage/state.json')

    try {
      const state = await readJsonFile<any>(statePath)

      if (!state?.currentTask) {
        return c.json({ success: false, error: 'No active task' }, 400)
      }

      const completedTask = state.currentTask

      // Update state
      const newState = {
        currentTask: null,
        previousTask: null,
        lastUpdated: new Date().toISOString(),
      }

      await writeJsonFile(statePath, newState)

      return c.json({
        success: true,
        completedTask,
        message: `Completed: ${completedTask.description}`,
      })
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // POST /projects/:id/task/pause - Pause current task
  // -------------------------------------------------------------------------
  api.post('/projects/:id/task/pause', async (c) => {
    const projectId = c.req.param('id')
    const projectPath = getProjectPath(projectId)
    const statePath = path.join(projectPath, 'storage/state.json')

    try {
      const body = await c.req.json().catch(() => ({}))
      const reason = body.reason

      const state = await readJsonFile<any>(statePath)

      if (!state?.currentTask) {
        return c.json({ success: false, error: 'No active task' }, 400)
      }

      const pausedTask = {
        id: state.currentTask.id,
        description: state.currentTask.description,
        status: 'paused',
        startedAt: state.currentTask.startedAt,
        pausedAt: new Date().toISOString(),
        pauseReason: reason,
      }

      const newState = {
        currentTask: null,
        previousTask: pausedTask,
        lastUpdated: new Date().toISOString(),
      }

      await writeJsonFile(statePath, newState)

      return c.json({
        success: true,
        pausedTask,
        message: `Paused: ${pausedTask.description}`,
      })
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // POST /projects/:id/task/resume - Resume paused task
  // -------------------------------------------------------------------------
  api.post('/projects/:id/task/resume', async (c) => {
    const projectId = c.req.param('id')
    const projectPath = getProjectPath(projectId)
    const statePath = path.join(projectPath, 'storage/state.json')

    try {
      const state = await readJsonFile<any>(statePath)

      if (!state?.previousTask) {
        return c.json({ success: false, error: 'No paused task' }, 400)
      }

      const resumedTask = {
        id: state.previousTask.id,
        description: state.previousTask.description,
        startedAt: new Date().toISOString(),
        sessionId: `sess_${Date.now().toString(36)}`,
      }

      const newState = {
        currentTask: resumedTask,
        previousTask: null,
        lastUpdated: new Date().toISOString(),
      }

      await writeJsonFile(statePath, newState)

      return c.json({
        success: true,
        resumedTask,
        message: `Resumed: ${resumedTask.description}`,
      })
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // POST /projects/:id/queue/start - Start a task from queue
  // -------------------------------------------------------------------------
  api.post('/projects/:id/queue/start', async (c) => {
    const projectId = c.req.param('id')
    const projectPath = getProjectPath(projectId)
    const statePath = path.join(projectPath, 'storage/state.json')
    const queuePath = path.join(projectPath, 'storage/queue.json')

    try {
      const body = await c.req.json()
      const { taskId } = body

      if (!taskId) {
        return c.json({ success: false, error: 'taskId required' }, 400)
      }

      const state = await readJsonFile<any>(statePath)
      const queue = await readJsonFile<any>(queuePath)

      // Check if there's already an active task
      if (state?.currentTask) {
        return c.json({ success: false, error: 'Complete or pause current task first' }, 400)
      }

      // Find task in queue
      const task = queue?.tasks?.find((t: any) => t.id === taskId)
      if (!task) {
        return c.json({ success: false, error: 'Task not found in queue' }, 404)
      }

      // Create new current task
      const newTask = {
        id: task.id,
        description: task.description,
        startedAt: new Date().toISOString(),
        sessionId: `sess_${Date.now().toString(36)}`,
        featureId: task.featureId,
      }

      // Update state
      const newState = {
        currentTask: newTask,
        previousTask: null,
        lastUpdated: new Date().toISOString(),
      }

      await writeJsonFile(statePath, newState)

      return c.json({
        success: true,
        task: newTask,
        message: `Started: ${newTask.description}`,
      })
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // POST /projects/:id/ideas - Capture a new idea
  // -------------------------------------------------------------------------
  api.post('/projects/:id/ideas', async (c) => {
    const projectId = c.req.param('id')
    const projectPath = getProjectPath(projectId)
    const ideasPath = path.join(projectPath, 'storage/ideas.json')

    try {
      const body = await c.req.json()
      const { text, priority = 'medium', tags = [] } = body

      if (!text) {
        return c.json({ success: false, error: 'text required' }, 400)
      }

      const ideas = (await readJsonFile<any>(ideasPath)) || { ideas: [], lastUpdated: '' }

      const newIdea = {
        id: `idea_${Date.now().toString(36)}`,
        text,
        status: 'pending',
        priority,
        tags,
        addedAt: new Date().toISOString(),
      }

      ideas.ideas.unshift(newIdea) // Prepend
      ideas.lastUpdated = new Date().toISOString()

      await writeJsonFile(ideasPath, ideas)

      return c.json({
        success: true,
        idea: newIdea,
        message: `Captured: ${text.slice(0, 50)}...`,
      })
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // GET /stats/global - Global stats across all projects
  // -------------------------------------------------------------------------
  api.get('/stats/global', async (c) => {
    try {
      await fs.mkdir(PROJECTS_DIR, { recursive: true })
      const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
      const projectIds = entries.filter((e) => e.isDirectory()).map((e) => e.name)

      let totalTasks = 0
      let totalIdeas = 0
      let totalShipped = 0
      let activeProjects = 0

      for (const id of projectIds) {
        const projectPath = getProjectPath(id)

        const state = await readJsonFile<any>(path.join(projectPath, 'storage/state.json'))
        const queue = await readJsonFile<any>(path.join(projectPath, 'storage/queue.json'))
        const ideas = await readJsonFile<any>(path.join(projectPath, 'storage/ideas.json'))
        const shipped = await readJsonFile<any>(path.join(projectPath, 'storage/shipped.json'))

        if (state?.currentTask) activeProjects++

        totalTasks += queue?.tasks?.filter((t: any) => !t.completed)?.length || 0
        totalIdeas += ideas?.ideas?.filter((i: any) => i.status === 'pending')?.length || 0
        totalShipped += shipped?.shipped?.length || 0
      }

      return c.json({
        totalProjects: projectIds.length,
        activeProjects,
        totalTasks,
        totalIdeas,
        totalShipped,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      return c.json({ error: String(error) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // GET /status-bar/compact - Optimized endpoint for status bar
  // Accepts optional ?cwd= param to show project-specific task
  // -------------------------------------------------------------------------
  api.get('/status-bar/compact', async (c) => {
    try {
      const cwd = c.req.query('cwd')

      await fs.mkdir(PROJECTS_DIR, { recursive: true })
      const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
      const projectIds = entries.filter((e) => e.isDirectory()).map((e) => e.name)

      // If cwd provided, find matching project by path
      let targetProjectId: string | null = null
      if (cwd) {
        for (const id of projectIds) {
          const config = await getProjectConfig(id)
          // Check both 'path' and 'repoPath' fields
          const projectPath = config?.repoPath || config?.path
          // Match if cwd starts with project path (handles subdirectories)
          if (projectPath && cwd.startsWith(projectPath)) {
            targetProjectId = id
            break
          }
        }
      }

      // Find active/paused task
      let activeProject: any = null
      let activeTask: any = null
      let pausedTask: any = null

      // If we have a target project, only check that one
      const idsToCheck = targetProjectId ? [targetProjectId] : projectIds

      for (const id of idsToCheck) {
        const projectPath = getProjectPath(id)
        const state = await readJsonFile<any>(path.join(projectPath, 'storage/state.json'))
        const config = await getProjectConfig(id)

        if (state?.currentTask) {
          activeProject = { id, name: config?.name || id, path: config?.repoPath || config?.path }
          activeTask = {
            ...state.currentTask,
            duration: await calculateDuration(state.currentTask.startedAt),
          }
          break
        }

        if (state?.previousTask && !pausedTask) {
          activeProject = { id, name: config?.name || id, path: config?.repoPath || config?.path }
          pausedTask = state.previousTask
        }
      }

      return c.json({
        hasActiveTask: !!activeTask,
        hasPausedTask: !!pausedTask,
        activeProject,
        activeTask,
        pausedTask,
        totalProjects: projectIds.length,
        // Include whether we filtered by cwd
        filtered: !!targetProjectId,
        cwd: cwd || null,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      return c.json({ error: String(error) }, 500)
    }
  })

  return api
}
