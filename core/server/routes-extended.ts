/**
 * Extended REST API Routes for prjct-cli Status Bar
 *
 * New endpoints for multi-project management and quick actions.
 * These complement the existing routes in routes.ts
 * All storage reads/writes go through SQLite via storage APIs.
 *
 * @version 3.0.0
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
import type { ProjectJson, QueueTask, StateTask } from '../types/storage'

// =============================================================================
// HELPERS
// =============================================================================

const GLOBAL_BASE = pathManager.getGlobalBasePath()
const PROJECTS_DIR = path.join(GLOBAL_BASE, 'projects')

function getProjectConfig(projectId: string): ProjectJson | null {
  return prjctDb.getDoc<ProjectJson>(projectId, 'project')
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
          // Read config
          const config = getProjectConfig(id)

          // Read state
          const state = await stateStorage.read(id)

          // Read queue for count
          const queue = await queueStorage.read(id)

          // Read ideas for count
          const ideas = await ideasStorage.read(id)

          // Read shipped for count
          const shipped = await shippedStorage.read(id)

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
              queueCount: queue?.tasks?.filter((t: QueueTask) => !t.completed)?.length || 0,
              ideasCount: ideas?.ideas?.filter((i) => i.status === 'pending')?.length || 0,
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
    } catch {
      return c.json({ projects: [], error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // GET /projects/:id/full - Complete project dashboard
  // -------------------------------------------------------------------------
  api.get('/projects/:id/full', async (c) => {
    const projectId = c.req.param('id')

    try {
      const [config, state, queue, ideas, shipped] = await Promise.all([
        Promise.resolve(getProjectConfig(projectId)),
        stateStorage.read(projectId),
        queueStorage.read(projectId),
        ideasStorage.read(projectId),
        shippedStorage.read(projectId),
      ])
      const roadmap = prjctDb.getDoc(projectId, 'roadmap')

      // Calculate current task duration
      if (state?.currentTask?.startedAt) {
        ;(state.currentTask as StateTask & { duration?: string }).duration =
          await calculateDuration(state.currentTask.startedAt)
      }

      // Calculate stats
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(todayStart)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())

      const completedToday =
        queue?.tasks?.filter((t: QueueTask) => {
          if (!t.completed || !t.completedAt) return false
          return new Date(t.completedAt) >= todayStart
        })?.length || 0

      const completedThisWeek =
        queue?.tasks?.filter((t: QueueTask) => {
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
          queueCount: queue?.tasks?.filter((t: QueueTask) => !t.completed)?.length || 0,
          ideasCount: ideas?.ideas?.filter((i) => i.status === 'pending')?.length || 0,
          shippedCount: shipped?.shipped?.length || 0,
        },
        timestamp: new Date().toISOString(),
      })
    } catch {
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // POST /projects/:id/task/complete - Complete current task
  // -------------------------------------------------------------------------
  api.post('/projects/:id/task/complete', async (c) => {
    const projectId = c.req.param('id')

    try {
      const state = await stateStorage.read(projectId)

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

      await stateStorage.write(projectId, newState as Parameters<typeof stateStorage.write>[1])

      return c.json({
        success: true,
        completedTask,
        message: `Completed: ${completedTask.description}`,
      })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // POST /projects/:id/task/pause - Pause current task
  // -------------------------------------------------------------------------
  api.post('/projects/:id/task/pause', async (c) => {
    const projectId = c.req.param('id')

    try {
      const body = await c.req.json().catch(() => ({}))
      const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined

      const state = await stateStorage.read(projectId)

      if (!state?.currentTask) {
        return c.json({ success: false, error: 'No active task' }, 400)
      }

      const pausedTask: StateTask = {
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

      await stateStorage.write(projectId, newState as Parameters<typeof stateStorage.write>[1])

      return c.json({
        success: true,
        pausedTask,
        message: `Paused: ${pausedTask.description}`,
      })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // POST /projects/:id/task/resume - Resume paused task
  // -------------------------------------------------------------------------
  api.post('/projects/:id/task/resume', async (c) => {
    const projectId = c.req.param('id')

    try {
      const state = await stateStorage.read(projectId)

      if (!state?.previousTask) {
        return c.json({ success: false, error: 'No paused task' }, 400)
      }

      const resumedTask: StateTask = {
        id: state.previousTask.id,
        description: state.previousTask.description,
        status: 'active',
        startedAt: new Date().toISOString(),
        sessionId: `sess_${Date.now().toString(36)}`,
      }

      const newState = {
        currentTask: resumedTask,
        previousTask: null,
        lastUpdated: new Date().toISOString(),
      }

      await stateStorage.write(projectId, newState as Parameters<typeof stateStorage.write>[1])

      return c.json({
        success: true,
        resumedTask,
        message: `Resumed: ${resumedTask.description}`,
      })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // POST /projects/:id/queue/start - Start a task from queue
  // -------------------------------------------------------------------------
  api.post('/projects/:id/queue/start', async (c) => {
    const projectId = c.req.param('id')

    try {
      const body = await c.req.json()
      const { taskId } = body

      if (!taskId || typeof taskId !== 'string') {
        return c.json({ success: false, error: 'taskId required (string)' }, 400)
      }

      if (taskId.length > 200) {
        return c.json({ success: false, error: 'taskId too long' }, 400)
      }

      const [state, queue] = await Promise.all([
        stateStorage.read(projectId),
        queueStorage.read(projectId),
      ])

      // Check if there's already an active task
      if (state?.currentTask) {
        return c.json({ success: false, error: 'Complete or pause current task first' }, 400)
      }

      // Find task in queue
      const task = queue?.tasks?.find((t: QueueTask) => t.id === taskId)
      if (!task) {
        return c.json({ success: false, error: 'Task not found in queue' }, 404)
      }

      // Create new current task
      const newTask: StateTask = {
        id: task.id,
        description: task.description,
        status: 'active',
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

      await stateStorage.write(projectId, newState as Parameters<typeof stateStorage.write>[1])

      return c.json({
        success: true,
        task: newTask,
        message: `Started: ${newTask.description}`,
      })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // POST /projects/:id/ideas - Capture a new idea
  // -------------------------------------------------------------------------
  api.post('/projects/:id/ideas', async (c) => {
    const projectId = c.req.param('id')

    try {
      const body = await c.req.json()
      const { text, priority = 'medium', tags = [] } = body

      if (!text || typeof text !== 'string') {
        return c.json({ success: false, error: 'text required (string)' }, 400)
      }

      if (text.length > 5000) {
        return c.json({ success: false, error: 'text too long (max 5000 chars)' }, 400)
      }

      const validPriorities = ['low', 'medium', 'high', 'critical']
      const safePriority = validPriorities.includes(priority) ? priority : 'medium'
      const safeTags = Array.isArray(tags)
        ? tags.filter((t): t is string => typeof t === 'string').slice(0, 20)
        : []

      const idea = await ideasStorage.addIdea(projectId, text, {
        priority: safePriority,
        tags: safeTags,
      })

      return c.json({
        success: true,
        idea,
        message: `Captured: ${text.slice(0, 50)}...`,
      })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
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
        const state = await stateStorage.read(id)
        const queue = await queueStorage.read(id)
        const ideas = await ideasStorage.read(id)
        const shipped = await shippedStorage.read(id)

        if (state?.currentTask) activeProjects++

        totalTasks += queue?.tasks?.filter((t: QueueTask) => !t.completed)?.length || 0
        totalIdeas += ideas?.ideas?.filter((i) => i.status === 'pending')?.length || 0
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
    } catch {
      return c.json({ error: 'Internal server error' }, 500)
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
          const config = getProjectConfig(id)
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
      let activeProject: { id: string; name: string; path: string | undefined } | null = null
      let activeTask: (StateTask & { duration?: string }) | null = null
      let pausedTask: StateTask | null = null

      // If we have a target project, only check that one
      const idsToCheck = targetProjectId ? [targetProjectId] : projectIds

      for (const id of idsToCheck) {
        const state = await stateStorage.read(id)
        const config = getProjectConfig(id)

        if (state?.currentTask) {
          activeProject = { id, name: config?.name || id, path: config?.repoPath || config?.path }
          activeTask = {
            ...state.currentTask,
            duration: await calculateDuration(state.currentTask.startedAt),
          } as StateTask & { duration?: string }
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
    } catch {
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  return api
}
