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
import { archiveStorage } from '../storage/archive-storage'
import { commentStorage } from '../storage/comment-storage'
import { contextZoneStorage } from '../storage/context-zone-storage'
import { customWorkflowStorage } from '../storage/custom-workflow-storage'
import { prjctDb } from '../storage/database'
import { ideasStorage } from '../storage/ideas-storage'
import { indexStorage } from '../storage/index-storage'
import { llmAnalysisStorage } from '../storage/llm-analysis-storage'
import { metricsStorage } from '../storage/metrics-storage'
import { queueStorage } from '../storage/queue-storage'
import { shippedStorage } from '../storage/shipped-storage'
import { stateStorage } from '../storage/state-storage'
import { velocityStorage } from '../storage/velocity-storage'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import type { IdeaPriority, ProjectJson, QueueTask, StateTask } from '../types/storage'

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

          // Cast config to access all fields
          const cfg = config as Record<string, unknown> | null

          return {
            id,
            name: cfg?.name || id.slice(0, 8),
            path: cfg?.repoPath || cfg?.path || null,
            stack: cfg?.stack || null,
            branch: cfg?.currentBranch || null,
            fileCount: cfg?.fileCount || null,
            lastSync: cfg?.lastSync || null,
            version: cfg?.version || null,
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
              tasksToday: 0,
              tasksThisWeek: 0,
            },
          }
        })
      )

      // Sort: active projects first, then by name
      projects.sort((a, b) => {
        if (a.currentTask && !b.currentTask) return -1
        if (!a.currentTask && b.currentTask) return 1
        return String(a.name || '').localeCompare(String(b.name || ''))
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

      // Enrich with LLM analysis if available
      let analysis = null
      try {
        const row = prjctDb.get<{ analysis: string }>(
          projectId,
          "SELECT analysis FROM llm_analysis WHERE status = 'active' LIMIT 1"
        )
        if (row) {
          const parsed = JSON.parse(row.analysis)
          analysis = {
            architecture: parsed.architecture,
            patterns: (parsed.patterns || []).slice(0, 6),
            antiPatterns: (parsed.antiPatterns || []).slice(0, 4),
            techDebt: (parsed.techDebt || []).slice(0, 4),
            conventions: parsed.conventions,
            stack: parsed.stack,
            analyzedAt: parsed.analyzedAt,
            commitHash: parsed.commitHash,
          }
        }
      } catch {
        // non-critical
      }

      return c.json({
        id: projectId,
        name: config?.name || projectId,
        path: config?.path,
        state: state || { currentTask: null, previousTask: null, lastUpdated: '' },
        queue: queue || { tasks: [], lastUpdated: '' },
        ideas: ideas || { ideas: [], lastUpdated: '' },
        shipped: shipped || { shipped: [], lastUpdated: '' },
        roadmap: roadmap || { features: [], backlog: [], lastUpdated: '' },
        analysis,
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

  // -------------------------------------------------------------------------
  // POST /projects/:id/queue - Create queue task
  // -------------------------------------------------------------------------
  api.post('/projects/:id/queue', async (c) => {
    const projectId = c.req.param('id')

    try {
      const body = await c.req.json()
      const { description, priority, type, section } = body

      if (!description || typeof description !== 'string') {
        return c.json({ success: false, error: 'description required (string)' }, 400)
      }

      if (description.length > 5000) {
        return c.json({ success: false, error: 'description too long (max 5000 chars)' }, 400)
      }

      const task = await queueStorage.addTask(projectId, {
        description,
        priority: priority || 'medium',
        type: type || 'feature',
        section: section || 'active',
      })

      return c.json({ success: true, task })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // GET /projects/:id/queue/:taskId - Get single task
  // -------------------------------------------------------------------------
  api.get('/projects/:id/queue/:taskId', async (c) => {
    const projectId = c.req.param('id')
    const taskId = c.req.param('taskId')
    try {
      const task = await queueStorage.getTask(projectId, taskId)
      if (!task) return c.json({ error: 'Task not found' }, 404)
      const comments = commentStorage.getComments(projectId, taskId)
      return c.json({ task, comments })
    } catch (e) {
      return c.json({ error: String(e) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // PATCH /projects/:id/queue/:taskId - Update queue task
  // -------------------------------------------------------------------------
  api.patch('/projects/:id/queue/:taskId', async (c) => {
    const projectId = c.req.param('id')
    const taskId = c.req.param('taskId')

    try {
      const body = await c.req.json().catch(() => ({}))
      const updates: Record<string, string> = {}

      if (body.priority && typeof body.priority === 'string') {
        const validPriorities = ['low', 'medium', 'high', 'critical', 'normal', 'urgent']
        if (!validPriorities.includes(body.priority))
          return c.json({ success: false, error: 'Invalid priority' }, 400)
        updates.priority = body.priority
      }
      if (body.section && typeof body.section === 'string') {
        const validSections = ['active', 'backlog', 'previously_active']
        if (!validSections.includes(body.section))
          return c.json({ success: false, error: 'Invalid section' }, 400)
        updates.section = body.section
      }
      if (typeof body.description === 'string') updates.description = body.description
      if (typeof body.body === 'string') updates.body = body.body
      if (typeof body.type === 'string') updates.type = body.type

      if (Object.keys(updates).length > 0) {
        const result = await queueStorage.updateTask(projectId, taskId, updates)
        if (!result) return c.json({ success: false, error: 'Task not found' }, 404)
      }

      return c.json({ success: true })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /projects/:id/queue/:taskId - Delete queue task
  // -------------------------------------------------------------------------
  api.delete('/projects/:id/queue/:taskId', async (c) => {
    const projectId = c.req.param('id')
    const taskId = c.req.param('taskId')

    try {
      await queueStorage.removeTask(projectId, taskId)
      return c.json({ success: true })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // POST /projects/:id/queue/:taskId/comments - Add comment
  // -------------------------------------------------------------------------
  api.post('/projects/:id/queue/:taskId/comments', async (c) => {
    const projectId = c.req.param('id')
    const taskId = c.req.param('taskId')
    try {
      const body = await c.req.json()
      const { content, author } = body as { content: string; author?: string }
      if (!content?.trim()) return c.json({ error: 'Content required' }, 400)
      const comment = commentStorage.addComment(projectId, taskId, content.trim(), author)
      return c.json({ comment })
    } catch (e) {
      return c.json({ error: String(e) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // PATCH /projects/:id/queue/:taskId/comments/:commentId - Update comment
  // -------------------------------------------------------------------------
  api.patch('/projects/:id/queue/:taskId/comments/:commentId', async (c) => {
    const projectId = c.req.param('id')
    const commentId = c.req.param('commentId')
    try {
      const body = await c.req.json()
      const { content } = body as { content: string }
      if (!content?.trim()) return c.json({ error: 'Content required' }, 400)
      const ok = commentStorage.updateComment(projectId, commentId, content.trim())
      return ok ? c.json({ success: true }) : c.json({ error: 'Not found' }, 404)
    } catch (e) {
      return c.json({ error: String(e) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /projects/:id/queue/:taskId/comments/:commentId - Delete comment
  // -------------------------------------------------------------------------
  api.delete('/projects/:id/queue/:taskId/comments/:commentId', (c) => {
    const projectId = c.req.param('id')
    const commentId = c.req.param('commentId')
    try {
      commentStorage.deleteComment(projectId, commentId)
      return c.json({ success: true })
    } catch (e) {
      return c.json({ error: String(e) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // PATCH /projects/:id/ideas/:ideaId - Update idea
  // -------------------------------------------------------------------------
  api.patch('/projects/:id/ideas/:ideaId', async (c) => {
    const projectId = c.req.param('id')
    const ideaId = c.req.param('ideaId')

    try {
      const body = await c.req.json().catch(() => ({}))
      const { priority, tags } = body

      if (priority) {
        const validPriorities = ['low', 'medium', 'high']
        if (!validPriorities.includes(priority)) {
          return c.json({ success: false, error: 'Invalid priority' }, 400)
        }
        await ideasStorage.setPriority(projectId, ideaId, priority as IdeaPriority)
      }

      if (tags && Array.isArray(tags)) {
        const safeTags = tags.filter((t): t is string => typeof t === 'string').slice(0, 20)
        if (safeTags.length > 0) {
          await ideasStorage.addTags(projectId, ideaId, safeTags)
        }
      }

      return c.json({ success: true })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /projects/:id/ideas/:ideaId - Delete idea
  // -------------------------------------------------------------------------
  api.delete('/projects/:id/ideas/:ideaId', async (c) => {
    const projectId = c.req.param('id')
    const ideaId = c.req.param('ideaId')

    try {
      await ideasStorage.removeIdea(projectId, ideaId)
      return c.json({ success: true })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // POST /projects/:id/ideas/:ideaId/archive - Archive idea
  // -------------------------------------------------------------------------
  api.post('/projects/:id/ideas/:ideaId/archive', async (c) => {
    const projectId = c.req.param('id')
    const ideaId = c.req.param('ideaId')

    try {
      await ideasStorage.archive(projectId, ideaId)
      return c.json({ success: true })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // PATCH /projects/:id/task - Update current task metadata
  // -------------------------------------------------------------------------
  api.patch('/projects/:id/task', async (c) => {
    const projectId = c.req.param('id')

    try {
      const body = await c.req.json().catch(() => ({}))
      const { description, type, branch } = body

      const updates: Record<string, string> = {}
      if (description && typeof description === 'string') updates.description = description
      if (type && typeof type === 'string') updates.type = type
      if (branch && typeof branch === 'string') updates.branch = branch

      if (Object.keys(updates).length === 0) {
        return c.json({ success: false, error: 'No valid fields to update' }, 400)
      }

      const updated = await stateStorage.updateCurrentTask(projectId, updates)

      if (!updated) {
        return c.json({ success: false, error: 'No active task' }, 400)
      }

      return c.json({ success: true })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // PATCH /projects/:id - Update project metadata (name)
  // -------------------------------------------------------------------------
  api.patch('/projects/:id', async (c) => {
    const projectId = c.req.param('id')
    try {
      const body = await c.req.json().catch(() => ({}))
      const { name, description, stack, techStack, repoPath } = body as {
        name?: string
        description?: string
        stack?: string
        techStack?: string[]
        repoPath?: string
      }

      const globalPath = pathManager.getGlobalProjectPath(projectId)
      const configPath = path.join(globalPath, 'project.json')

      let config: Record<string, unknown> = {}
      try {
        const raw = await fs.readFile(configPath, 'utf-8')
        config = JSON.parse(raw)
      } catch {
        config = { projectId }
      }

      if (name !== undefined) config.name = name
      if (description !== undefined) config.description = description
      if (stack !== undefined) config.stack = stack
      if (techStack !== undefined) config.techStack = techStack
      if (repoPath !== undefined) config.repoPath = repoPath

      await fs.mkdir(path.dirname(configPath), { recursive: true })
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      return c.json({ success: true })
    } catch {
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /projects/:id - Delete project data
  // -------------------------------------------------------------------------
  api.delete('/projects/:id', async (c) => {
    const projectId = c.req.param('id')
    try {
      // Close DB connection
      prjctDb.close(projectId)

      // Remove project directory
      const globalPath = pathManager.getGlobalProjectPath(projectId)
      await fs.rm(globalPath, { recursive: true, force: true })

      return c.json({ success: true })
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // Workflow Graph (visual edges/connections)
  // -------------------------------------------------------------------------
  api.get('/projects/:id/workflow-graph', (c) => {
    const projectId = c.req.param('id')
    try {
      const doc = prjctDb.getDoc<{ edges: unknown[] }>(projectId, 'workflow-graph')
      return c.json({ edges: doc?.edges || [] })
    } catch {
      return c.json({ edges: [] })
    }
  })

  api.put('/projects/:id/workflow-graph', async (c) => {
    const projectId = c.req.param('id')
    try {
      const body = await c.req.json()
      const { edges } = body as { edges: unknown[] }
      prjctDb.setDoc(projectId, 'workflow-graph', { edges: edges || [] })
      return c.json({ success: true })
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 500)
    }
  })

  // -------------------------------------------------------------------------
  // Workflow APIs
  // -------------------------------------------------------------------------

  // GET /projects/:id/workflows — list all workflows
  api.get('/projects/:id/workflows', (c) => {
    const projectId = c.req.param('id')
    try {
      const workflows = customWorkflowStorage.getAllWorkflows(projectId)
      const rules = workflowRuleStorage.getAllRules(projectId)
      return c.json({ workflows, rules })
    } catch {
      return c.json({ workflows: [], rules: [] })
    }
  })

  // PATCH /projects/:id/workflows/:name — toggle workflow enabled
  api.patch('/projects/:id/workflows/:name', async (c) => {
    const { id: projectId, name } = c.req.param()
    try {
      const body = await c.req.json().catch(() => ({}))
      const { enabled } = body as { enabled?: boolean }
      const workflow = customWorkflowStorage.getWorkflow(projectId, name)
      if (!workflow) return c.json({ success: false, error: 'Workflow not found' }, 404)
      customWorkflowStorage.updateWorkflow(projectId, name, {
        enabled: enabled ?? !workflow.enabled,
      })
      return c.json({ success: true })
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 500)
    }
  })

  // POST /projects/:id/workflow-rules — add a rule
  api.post('/projects/:id/workflow-rules', async (c) => {
    const projectId = c.req.param('id')
    try {
      const body = await c.req.json()
      const { type, command, position, action, description, enabled, timeoutMs } = body as {
        type: string
        command: string
        position: string
        action: string
        description?: string
        enabled?: boolean
        timeoutMs?: number
      }
      const id = workflowRuleStorage.addRule(projectId, {
        type: type as 'hook' | 'gate' | 'step' | 'instruction',
        command,
        position,
        action,
        description: description || null,
        enabled: enabled ?? true,
        timeoutMs: timeoutMs ?? 30000,
        createdAt: new Date().toISOString(),
        sortOrder: 0,
      })
      return c.json({ success: true, id })
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 500)
    }
  })

  // PATCH /projects/:id/workflow-rules/:ruleId — update a rule
  api.patch('/projects/:id/workflow-rules/:ruleId', async (c) => {
    const projectId = c.req.param('id')
    const ruleId = Number(c.req.param('ruleId'))
    try {
      const body = await c.req.json()
      workflowRuleStorage.updateRule(projectId, ruleId, body)
      return c.json({ success: true })
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 500)
    }
  })

  // DELETE /projects/:id/workflow-rules/:ruleId — delete a rule
  api.delete('/projects/:id/workflow-rules/:ruleId', (c) => {
    const projectId = c.req.param('id')
    const ruleId = Number(c.req.param('ruleId'))
    try {
      workflowRuleStorage.removeRule(projectId, ruleId)
      return c.json({ success: true })
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 500)
    }
  })

  // =========================================================================
  // DATA APIs — expose ALL project data to web dashboard
  // =========================================================================

  // GET /projects/:id/metrics — token savings, compression, daily stats
  api.get('/projects/:id/metrics', async (c) => {
    const projectId = c.req.param('id')
    try {
      const summary = await metricsStorage.getSummary(projectId)
      const dailyStats = await metricsStorage.getDailyStats(projectId, 90)
      return c.json({ ...summary, dailyStats })
    } catch {
      return c.json({ totalTokensSaved: 0, avgCompressionRate: 0, syncCount: 0, dailyStats: [] })
    }
  })

  // GET /projects/:id/velocity — sprint velocity, trends
  api.get('/projects/:id/velocity', async (c) => {
    const projectId = c.req.param('id')
    try {
      const metrics = await velocityStorage.getMetrics(projectId)
      return c.json(metrics)
    } catch {
      return c.json({ averageVelocity: 0, velocityTrend: 'stable', sprints: [] })
    }
  })

  // GET /projects/:id/analysis/full — complete LLM analysis (not sliced)
  api.get('/projects/:id/analysis/full', (c) => {
    const projectId = c.req.param('id')
    try {
      const active = llmAnalysisStorage.getActive(projectId)
      const history = llmAnalysisStorage.getHistory(projectId, 10)
      return c.json({ analysis: active, history })
    } catch {
      return c.json({ analysis: null, history: [] })
    }
  })

  // GET /projects/:id/index — project structure, languages, domains
  api.get('/projects/:id/index', async (c) => {
    const projectId = c.req.param('id')
    try {
      const index = await indexStorage.readIndex(projectId)
      const domains = await indexStorage.readDomains(projectId)
      const scores = await indexStorage.readScores(projectId)
      const categories = await indexStorage.readCategories(projectId)
      return c.json({ index, domains, scores: scores?.slice(0, 100), categories })
    } catch {
      return c.json({ index: null, domains: null, scores: [], categories: null })
    }
  })

  // GET /projects/:id/archives — archived items
  api.get('/projects/:id/archives', (c) => {
    const projectId = c.req.param('id')
    const type = c.req.query('type') || undefined
    const limit = Number(c.req.query('limit')) || 50
    try {
      const items = archiveStorage.getArchived(projectId, type as any, limit)
      const stats = archiveStorage.getStats(projectId)
      return c.json({ items, stats })
    } catch {
      return c.json({ items: [], stats: { total: 0, byType: {} } })
    }
  })

  // GET /projects/:id/context-health — context zone analytics
  api.get('/projects/:id/context-health', (c) => {
    const projectId = c.req.param('id')
    try {
      const summary = contextZoneStorage.getSummary(projectId, 30)
      const transitions = contextZoneStorage.getTransitions(projectId, 50)
      return c.json({ summary, transitions })
    } catch {
      return c.json({ summary: null, transitions: [] })
    }
  })

  // GET /projects/:id/context-feedback — file suggestion accuracy
  api.get('/projects/:id/context-feedback', (c) => {
    const projectId = c.req.param('id')
    try {
      const rows = prjctDb.query<Record<string, unknown>>(
        projectId,
        'SELECT * FROM context_feedback ORDER BY created_at DESC LIMIT 50'
      )
      return c.json({ feedback: rows })
    } catch {
      return c.json({ feedback: [] })
    }
  })

  // GET /projects/:id/state/full — complete state with paused tasks + full history
  api.get('/projects/:id/state/full', async (c) => {
    const projectId = c.req.param('id')
    try {
      const state = await stateStorage.read(projectId)
      return c.json(state)
    } catch {
      return c.json({
        currentTask: null,
        previousTask: null,
        pausedTasks: [],
        taskHistory: [],
        lastUpdated: '',
      })
    }
  })

  // =========================================================================
  // REMAINING DATA — events, memory, sessions, tasks, kv raw, subtasks
  // =========================================================================

  // GET /projects/:id/events — activity/event log (paginated)
  api.get('/projects/:id/events', (c) => {
    const projectId = c.req.param('id')
    const limit = Number(c.req.query('limit')) || 100
    const offset = Number(c.req.query('offset')) || 0
    const type = c.req.query('type') || undefined
    try {
      const events = type
        ? prjctDb.query<Record<string, unknown>>(
            projectId,
            'SELECT * FROM events WHERE type = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
            type,
            limit,
            offset
          )
        : prjctDb.query<Record<string, unknown>>(
            projectId,
            'SELECT * FROM events ORDER BY timestamp DESC LIMIT ? OFFSET ?',
            limit,
            offset
          )
      const total = prjctDb.get<{ c: number }>(projectId, 'SELECT COUNT(*) as c FROM events')
      return c.json({ events, total: total?.c || 0, limit, offset })
    } catch {
      return c.json({ events: [], total: 0 })
    }
  })

  // GET /projects/:id/memory — project memory/learnings
  api.get('/projects/:id/memory', (c) => {
    const projectId = c.req.param('id')
    try {
      const items = prjctDb.query<Record<string, unknown>>(
        projectId,
        'SELECT * FROM memory ORDER BY updated_at DESC LIMIT 200'
      )
      return c.json({ items })
    } catch {
      return c.json({ items: [] })
    }
  })

  // GET /projects/:id/sessions — work sessions
  api.get('/projects/:id/sessions', (c) => {
    const projectId = c.req.param('id')
    try {
      const sessions = prjctDb.query<Record<string, unknown>>(
        projectId,
        'SELECT * FROM sessions ORDER BY started_at DESC LIMIT 50'
      )
      const agentSessions = prjctDb.query<Record<string, unknown>>(
        projectId,
        'SELECT * FROM agent_sessions ORDER BY started_at DESC LIMIT 50'
      )
      return c.json({ sessions, agentSessions })
    } catch {
      return c.json({ sessions: [], agentSessions: [] })
    }
  })

  // GET /projects/:id/tasks — normalized tasks table (completed tasks with subtasks)
  api.get('/projects/:id/tasks', (c) => {
    const projectId = c.req.param('id')
    try {
      const tasks = prjctDb.query<Record<string, unknown>>(
        projectId,
        'SELECT * FROM tasks ORDER BY started_at DESC LIMIT 100'
      )
      const subtasks = prjctDb.query<Record<string, unknown>>(
        projectId,
        'SELECT * FROM subtasks ORDER BY sort_order ASC'
      )
      return c.json({ tasks, subtasks })
    } catch {
      return c.json({ tasks: [], subtasks: [] })
    }
  })

  // GET /projects/:id/kv — all kv_store keys (raw data access)
  api.get('/projects/:id/kv', (c) => {
    const projectId = c.req.param('id')
    try {
      const keys = prjctDb.query<{ key: string; value: string }>(
        projectId,
        'SELECT key, value FROM kv_store ORDER BY key'
      )
      const result: Record<string, unknown> = {}
      for (const row of keys) {
        try {
          result[row.key] = JSON.parse(row.value)
        } catch {
          result[row.key] = row.value
        }
      }
      return c.json(result)
    } catch {
      return c.json({})
    }
  })

  // GET /projects/:id/issues — synced external issues (Linear/Jira)
  api.get('/projects/:id/issues', (c) => {
    const projectId = c.req.param('id')
    try {
      const doc = prjctDb.getDoc<{ issues: unknown[] }>(projectId, 'issues')
      return c.json({ issues: doc?.issues || [] })
    } catch {
      return c.json({ issues: [] })
    }
  })

  // GET /projects/:id/roadmap — full roadmap data
  api.get('/projects/:id/roadmap', (c) => {
    const projectId = c.req.param('id')
    try {
      const doc = prjctDb.getDoc<Record<string, unknown>>(projectId, 'roadmap')
      return c.json(doc || { features: [], backlog: [] })
    } catch {
      return c.json({ features: [], backlog: [] })
    }
  })

  // GET /projects/:id/config — full project config
  api.get('/projects/:id/config', async (c) => {
    const projectId = c.req.param('id')
    try {
      const config = getProjectConfig(projectId)
      return c.json(config || { projectId })
    } catch {
      return c.json({ projectId })
    }
  })

  return api
}
