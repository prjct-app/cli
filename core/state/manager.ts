/**
 * State Manager
 *
 * Manages unified project state with atomic read/write operations.
 * Replaces scattered file reads with single state.json access.
 */

import path from 'path'
import * as fileHelper from '../utils/file-helper'
import pathManager from '../infrastructure/path-manager'
import type {
  ProjectState,
  CurrentTask,
  QueuedTask,
  ActiveFeature,
  PerformanceStats,
  RecentActivity,
  StateUpdate,
} from './types'
import { DEFAULT_STATE } from './types'

const STATE_FILENAME = 'state.json'
const MAX_RECENT_ACTIVITY = 10

/**
 * StateManager - Single source of truth for project state.
 */
export class StateManager {
  private cache: Map<string, ProjectState> = new Map()
  private cacheTimeout = 5000 // 5 seconds
  private lastRead: Map<string, number> = new Map()

  /**
   * Get state file path for a project.
   */
  private getStatePath(projectId: string): string {
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    return path.join(globalPath, 'core', STATE_FILENAME)
  }

  /**
   * Read project state.
   * Uses cache if available and fresh.
   */
  async read(projectId: string): Promise<ProjectState> {
    const now = Date.now()
    const lastReadTime = this.lastRead.get(projectId) || 0

    // Return cached if fresh
    if (now - lastReadTime < this.cacheTimeout && this.cache.has(projectId)) {
      return this.cache.get(projectId)!
    }

    const statePath = this.getStatePath(projectId)
    const state = await fileHelper.readJson<ProjectState>(statePath, {
      ...DEFAULT_STATE,
      projectId,
    })

    // Update cache
    this.cache.set(projectId, state)
    this.lastRead.set(projectId, now)

    return state
  }

  /**
   * Write project state atomically.
   */
  async write(projectId: string, state: ProjectState): Promise<void> {
    const statePath = this.getStatePath(projectId)

    // Ensure directory exists
    await fileHelper.ensureDir(path.dirname(statePath))

    // Update lastSync
    const updatedState: ProjectState = {
      ...state,
      lastSync: new Date().toISOString(),
    }

    await fileHelper.writeJson(statePath, updatedState)

    // Update cache
    this.cache.set(projectId, updatedState)
    this.lastRead.set(projectId, Date.now())
  }

  /**
   * Apply an update to project state.
   */
  async update(projectId: string, update: StateUpdate): Promise<ProjectState> {
    const state = await this.read(projectId)
    const newState = this.applyUpdate(state, update)
    await this.write(projectId, newState)
    return newState
  }

  /**
   * Apply multiple updates atomically.
   */
  async batchUpdate(projectId: string, updates: StateUpdate[]): Promise<ProjectState> {
    let state = await this.read(projectId)
    for (const update of updates) {
      state = this.applyUpdate(state, update)
    }
    await this.write(projectId, state)
    return state
  }

  /**
   * Apply a single update to state.
   */
  private applyUpdate(state: ProjectState, update: StateUpdate): ProjectState {
    switch (update.type) {
      case 'SET_CURRENT_TASK':
        return { ...state, currentTask: update.task }

      case 'ADD_TO_QUEUE':
        return {
          ...state,
          queue: [...state.queue, update.task].sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
            return priorityOrder[a.priority] - priorityOrder[b.priority]
          }),
        }

      case 'REMOVE_FROM_QUEUE':
        return {
          ...state,
          queue: state.queue.filter((t) => t.id !== update.taskId),
        }

      case 'UPDATE_QUEUE_TASK':
        return {
          ...state,
          queue: state.queue.map((t) =>
            t.id === update.taskId ? { ...t, ...update.updates } : t
          ),
        }

      case 'SET_ACTIVE_FEATURE':
        return { ...state, activeFeature: update.feature }

      case 'UPDATE_STATS':
        return {
          ...state,
          stats: { ...state.stats, ...update.stats },
        }

      case 'ADD_ACTIVITY':
        return {
          ...state,
          recentActivity: [update.activity, ...state.recentActivity].slice(
            0,
            MAX_RECENT_ACTIVITY
          ),
        }

      case 'SYNC':
        return { ...state, lastSync: new Date().toISOString() }

      default:
        return state
    }
  }

  // =========== Convenience Methods ===========

  /**
   * Start a new task.
   */
  async startTask(
    projectId: string,
    task: Omit<CurrentTask, 'startedAt'>
  ): Promise<ProjectState> {
    const currentTask: CurrentTask = {
      ...task,
      startedAt: new Date().toISOString(),
    }

    return this.batchUpdate(projectId, [
      { type: 'SET_CURRENT_TASK', task: currentTask },
      {
        type: 'ADD_ACTIVITY',
        activity: {
          type: 'session_started',
          description: task.description,
          timestamp: new Date().toISOString(),
        },
      },
    ])
  }

  /**
   * Complete the current task.
   */
  async completeTask(projectId: string, duration: string): Promise<ProjectState> {
    const state = await this.read(projectId)
    if (!state.currentTask) {
      throw new Error('No active task to complete')
    }

    const activity: RecentActivity = {
      type: 'task_completed',
      description: state.currentTask.description,
      timestamp: new Date().toISOString(),
      duration,
    }

    // Update feature progress if linked
    let featureUpdate: StateUpdate | null = null
    if (state.activeFeature && state.currentTask.featureId === state.activeFeature.id) {
      featureUpdate = {
        type: 'SET_ACTIVE_FEATURE',
        feature: {
          ...state.activeFeature,
          tasksCompleted: state.activeFeature.tasksCompleted + 1,
          tasksRemaining: Math.max(0, state.activeFeature.tasksRemaining - 1),
        },
      }
    }

    const updates: StateUpdate[] = [
      { type: 'SET_CURRENT_TASK', task: null },
      { type: 'ADD_ACTIVITY', activity },
      {
        type: 'UPDATE_STATS',
        stats: { tasksToday: state.stats.tasksToday + 1 },
      },
    ]

    if (featureUpdate) {
      updates.push(featureUpdate)
    }

    return this.batchUpdate(projectId, updates)
  }

  /**
   * Pause the current task.
   */
  async pauseTask(projectId: string, reason?: string): Promise<ProjectState> {
    const state = await this.read(projectId)
    if (!state.currentTask) {
      throw new Error('No active task to pause')
    }

    const pausedTask: CurrentTask = {
      ...state.currentTask,
      pausedAt: new Date().toISOString(),
      pauseReason: reason,
    }

    return this.update(projectId, { type: 'SET_CURRENT_TASK', task: pausedTask })
  }

  /**
   * Resume a paused task.
   */
  async resumeTask(projectId: string): Promise<ProjectState> {
    const state = await this.read(projectId)
    if (!state.currentTask || !state.currentTask.pausedAt) {
      throw new Error('No paused task to resume')
    }

    const resumedTask: CurrentTask = {
      ...state.currentTask,
      pausedAt: undefined,
      pauseReason: undefined,
    }

    return this.update(projectId, { type: 'SET_CURRENT_TASK', task: resumedTask })
  }

  /**
   * Add a task to the queue.
   */
  async addToQueue(
    projectId: string,
    task: Omit<QueuedTask, 'id' | 'createdAt'>
  ): Promise<ProjectState> {
    const queuedTask: QueuedTask = {
      ...task,
      id: `task_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }

    return this.update(projectId, { type: 'ADD_TO_QUEUE', task: queuedTask })
  }

  /**
   * Get the next task from queue.
   */
  async getNextTask(projectId: string): Promise<QueuedTask | null> {
    const state = await this.read(projectId)
    return state.queue.find((t) => t.blockedReason === undefined) || null
  }

  /**
   * Start a feature.
   */
  async startFeature(
    projectId: string,
    feature: Omit<ActiveFeature, 'startedAt' | 'tasksCompleted' | 'status'>
  ): Promise<ProjectState> {
    const activeFeature: ActiveFeature = {
      ...feature,
      status: 'in_progress',
      tasksCompleted: 0,
      startedAt: new Date().toISOString(),
    }

    return this.update(projectId, { type: 'SET_ACTIVE_FEATURE', feature: activeFeature })
  }

  /**
   * Ship a feature.
   */
  async shipFeature(projectId: string): Promise<ProjectState> {
    const state = await this.read(projectId)
    if (!state.activeFeature) {
      throw new Error('No active feature to ship')
    }

    const activity: RecentActivity = {
      type: 'feature_shipped',
      description: state.activeFeature.name,
      timestamp: new Date().toISOString(),
    }

    return this.batchUpdate(projectId, [
      { type: 'SET_ACTIVE_FEATURE', feature: null },
      { type: 'ADD_ACTIVITY', activity },
    ])
  }

  /**
   * Clear cache for a project.
   */
  clearCache(projectId?: string): void {
    if (projectId) {
      this.cache.delete(projectId)
      this.lastRead.delete(projectId)
    } else {
      this.cache.clear()
      this.lastRead.clear()
    }
  }

  /**
   * Check if project has state file.
   */
  async exists(projectId: string): Promise<boolean> {
    const statePath = this.getStatePath(projectId)
    return fileHelper.fileExists(statePath)
  }

  /**
   * Initialize state for a new project.
   */
  async initialize(projectId: string): Promise<ProjectState> {
    const initialState: ProjectState = {
      ...DEFAULT_STATE,
      projectId,
      lastSync: new Date().toISOString(),
    }

    await this.write(projectId, initialState)
    return initialState
  }
}

// Singleton instance
const stateManager = new StateManager()
export default stateManager
