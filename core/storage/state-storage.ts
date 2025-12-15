/**
 * State Storage
 *
 * Manages current task state via storage/state.json
 * Generates context/now.md for Claude
 */

import { StorageManager } from './storage-manager'
import { generateUUID } from '../schemas'
import type { StateJson, CurrentTask, PreviousTask } from '../schemas/state'

class StateStorage extends StorageManager<StateJson> {
  constructor() {
    super('state.json')
  }

  protected getDefault(): StateJson {
    return {
      currentTask: null,
      previousTask: null,
      lastUpdated: ''
    }
  }

  protected getMdFilename(): string {
    return 'now.md'
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `state.${action}d`
  }

  protected toMarkdown(data: StateJson): string {
    const lines = ['# NOW', '']

    // Show current task if exists
    if (data.currentTask) {
      const task = data.currentTask
      lines.push(`**${task.description}**`)
      lines.push('')
      lines.push(`Started: ${task.startedAt}`)
      lines.push(`Session: ${task.sessionId}`)
      if (task.featureId) {
        lines.push(`Feature: ${task.featureId}`)
      }
    } else {
      lines.push('*No active task. Use /p:work to start.*')
    }

    // Show paused task section if exists
    if (data.previousTask) {
      lines.push('')
      lines.push('---')
      lines.push('')
      lines.push('## Paused')
      lines.push('')
      lines.push(`**${data.previousTask.description}**`)
      lines.push(`Paused: ${data.previousTask.pausedAt}`)
      if (data.previousTask.pauseReason) {
        lines.push(`Reason: ${data.previousTask.pauseReason}`)
      }
      lines.push('')
      lines.push('*Use /p:resume to continue*')
    }

    lines.push('')
    return lines.join('\n')
  }

  // =========== Domain Methods ===========

  /**
   * Get current active task
   */
  async getCurrentTask(projectId: string): Promise<CurrentTask | null> {
    const state = await this.read(projectId)
    return state.currentTask
  }

  /**
   * Start a new task
   */
  async startTask(
    projectId: string,
    task: Omit<CurrentTask, 'startedAt'>
  ): Promise<CurrentTask> {
    const currentTask: CurrentTask = {
      ...task,
      startedAt: new Date().toISOString()
    }

    await this.update(projectId, (state) => ({
      ...state,
      currentTask,
      lastUpdated: new Date().toISOString()
    }))

    // Publish incremental event
    await this.publishEvent(projectId, 'task.started', {
      taskId: currentTask.id,
      description: currentTask.description,
      startedAt: currentTask.startedAt,
      sessionId: currentTask.sessionId
    })

    return currentTask
  }

  /**
   * Complete current task
   */
  async completeTask(projectId: string): Promise<CurrentTask | null> {
    const state = await this.read(projectId)
    const completedTask = state.currentTask

    if (!completedTask) {
      return null
    }

    await this.update(projectId, () => ({
      currentTask: null,
      previousTask: null,
      lastUpdated: new Date().toISOString()
    }))

    // Publish incremental event
    await this.publishEvent(projectId, 'task.completed', {
      taskId: completedTask.id,
      description: completedTask.description,
      startedAt: completedTask.startedAt,
      completedAt: new Date().toISOString()
    })

    return completedTask
  }

  /**
   * Pause current task
   */
  async pauseTask(projectId: string, reason?: string): Promise<PreviousTask | null> {
    const state = await this.read(projectId)

    if (!state.currentTask) {
      return null
    }

    const previousTask: PreviousTask = {
      id: state.currentTask.id,
      description: state.currentTask.description,
      status: 'paused',
      startedAt: state.currentTask.startedAt,
      pausedAt: new Date().toISOString(),
      pauseReason: reason
    }

    await this.update(projectId, () => ({
      currentTask: null,
      previousTask,
      lastUpdated: new Date().toISOString()
    }))

    // Publish incremental event
    await this.publishEvent(projectId, 'task.paused', {
      taskId: previousTask.id,
      description: previousTask.description,
      pausedAt: previousTask.pausedAt,
      reason
    })

    return previousTask
  }

  /**
   * Resume paused task
   */
  async resumeTask(projectId: string): Promise<CurrentTask | null> {
    const state = await this.read(projectId)

    if (!state.previousTask) {
      return null
    }

    const currentTask: CurrentTask = {
      id: state.previousTask.id,
      description: state.previousTask.description,
      startedAt: new Date().toISOString(),
      sessionId: generateUUID()
    }

    await this.update(projectId, () => ({
      currentTask,
      previousTask: null,
      lastUpdated: new Date().toISOString()
    }))

    // Publish incremental event
    await this.publishEvent(projectId, 'task.resumed', {
      taskId: currentTask.id,
      description: currentTask.description,
      resumedAt: currentTask.startedAt
    })

    return currentTask
  }

  /**
   * Clear all task state
   */
  async clearTask(projectId: string): Promise<void> {
    await this.update(projectId, () => ({
      currentTask: null,
      previousTask: null,
      lastUpdated: new Date().toISOString()
    }))
  }

  /**
   * Check if there's an active or paused task
   */
  async hasTask(projectId: string): Promise<boolean> {
    const state = await this.read(projectId)
    return state.currentTask !== null || state.previousTask !== null
  }

  /**
   * Get paused task
   */
  async getPausedTask(projectId: string): Promise<PreviousTask | null> {
    const state = await this.read(projectId)
    return state.previousTask || null
  }
}

export const stateStorage = new StateStorage()
export default stateStorage
