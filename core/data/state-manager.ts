/**
 * State Manager
 *
 * Manages state.json - the unified project state.
 */

import { BaseManager } from './base-manager'
import type {
  StateSchema,
  CurrentTask,
  QueuedTask,
  RecentActivity,
  Stats
} from '../schemas'
import { DEFAULT_STATE, DEFAULT_STATS } from '../schemas'

const MAX_RECENT_ACTIVITY = 10

class StateManager extends BaseManager<StateSchema> {
  constructor() {
    super('state.json')
  }

  protected getDefault(projectId: string): StateSchema {
    return {
      ...DEFAULT_STATE,
      projectId,
      lastSync: new Date().toISOString()
    }
  }

  // =========== Current Task ===========

  async getCurrentTask(projectId: string): Promise<CurrentTask | null> {
    const state = await this.read(projectId)
    return state.currentTask
  }

  async setCurrentTask(projectId: string, task: CurrentTask | null): Promise<StateSchema> {
    return this.update(projectId, (state) => ({
      ...state,
      currentTask: task,
      lastSync: new Date().toISOString()
    }))
  }

  async startTask(
    projectId: string,
    task: Omit<CurrentTask, 'startedAt'>
  ): Promise<StateSchema> {
    const currentTask: CurrentTask = {
      ...task,
      startedAt: new Date().toISOString()
    }

    return this.update(projectId, (state) => ({
      ...state,
      currentTask,
      recentActivity: [
        {
          type: 'session_started' as const,
          description: task.description,
          timestamp: new Date().toISOString()
        },
        ...state.recentActivity
      ].slice(0, MAX_RECENT_ACTIVITY),
      lastSync: new Date().toISOString()
    }))
  }

  async completeTask(projectId: string, duration: string): Promise<StateSchema> {
    const state = await this.read(projectId)
    if (!state.currentTask) {
      throw new Error('No active task to complete')
    }

    const activity: RecentActivity = {
      type: 'task_completed',
      description: state.currentTask.description,
      timestamp: new Date().toISOString(),
      duration
    }

    return this.update(projectId, (s) => ({
      ...s,
      currentTask: null,
      recentActivity: [activity, ...s.recentActivity].slice(0, MAX_RECENT_ACTIVITY),
      stats: {
        ...s.stats,
        tasksToday: s.stats.tasksToday + 1
      },
      lastSync: new Date().toISOString()
    }))
  }

  async pauseTask(projectId: string, reason?: string): Promise<StateSchema> {
    const state = await this.read(projectId)
    if (!state.currentTask) {
      throw new Error('No active task to pause')
    }

    return this.update(projectId, (s) => ({
      ...s,
      currentTask: s.currentTask
        ? {
            ...s.currentTask,
            pausedAt: new Date().toISOString(),
            pauseReason: reason
          }
        : null,
      lastSync: new Date().toISOString()
    }))
  }

  async resumeTask(projectId: string): Promise<StateSchema> {
    const state = await this.read(projectId)
    if (!state.currentTask?.pausedAt) {
      throw new Error('No paused task to resume')
    }

    return this.update(projectId, (s) => ({
      ...s,
      currentTask: s.currentTask
        ? {
            ...s.currentTask,
            pausedAt: undefined,
            pauseReason: undefined
          }
        : null,
      lastSync: new Date().toISOString()
    }))
  }

  // =========== Queue ===========

  async getQueue(projectId: string): Promise<QueuedTask[]> {
    const state = await this.read(projectId)
    return state.queue
  }

  async addToQueue(
    projectId: string,
    task: Omit<QueuedTask, 'id' | 'createdAt'>
  ): Promise<StateSchema> {
    const queuedTask: QueuedTask = {
      ...task,
      id: `task_${Date.now()}`,
      createdAt: new Date().toISOString()
    }

    return this.update(projectId, (state) => ({
      ...state,
      queue: [...state.queue, queuedTask].sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }),
      lastSync: new Date().toISOString()
    }))
  }

  async removeFromQueue(projectId: string, taskId: string): Promise<StateSchema> {
    return this.update(projectId, (state) => ({
      ...state,
      queue: state.queue.filter((t) => t.id !== taskId),
      lastSync: new Date().toISOString()
    }))
  }

  async getNextTask(projectId: string): Promise<QueuedTask | null> {
    const state = await this.read(projectId)
    return state.queue.find((t) => !t.blockedReason) || null
  }

  // =========== Stats ===========

  async getStats(projectId: string): Promise<Stats> {
    const state = await this.read(projectId)
    return state.stats
  }

  async updateStats(projectId: string, stats: Partial<Stats>): Promise<StateSchema> {
    return this.update(projectId, (state) => ({
      ...state,
      stats: { ...state.stats, ...stats },
      lastSync: new Date().toISOString()
    }))
  }

  async resetDailyStats(projectId: string): Promise<StateSchema> {
    return this.update(projectId, (state) => ({
      ...state,
      stats: { ...state.stats, tasksToday: 0 },
      lastSync: new Date().toISOString()
    }))
  }

  // =========== Activity ===========

  async addActivity(projectId: string, activity: RecentActivity): Promise<StateSchema> {
    return this.update(projectId, (state) => ({
      ...state,
      recentActivity: [activity, ...state.recentActivity].slice(0, MAX_RECENT_ACTIVITY),
      lastSync: new Date().toISOString()
    }))
  }

  async getRecentActivity(projectId: string): Promise<RecentActivity[]> {
    const state = await this.read(projectId)
    return state.recentActivity
  }
}

export const stateManager = new StateManager()
export default stateManager
