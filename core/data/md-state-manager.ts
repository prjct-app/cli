/**
 * MD State Manager
 *
 * MD-First Architecture: Manages state via now.md.
 * Source of truth is the markdown file, not JSON.
 */

import { MdBaseManager } from './md-base-manager'
import { parseState, serializeState } from '../serializers'
import type { StateJson, CurrentTask, PreviousTask } from '../schemas/state'

class MdStateManager extends MdBaseManager<StateJson> {
  constructor() {
    super('core/now.md')
  }

  protected getDefault(): StateJson {
    return {
      currentTask: null,
      lastUpdated: ''
    }
  }

  protected parse(content: string): StateJson {
    return parseState(content)
  }

  protected serialize(data: StateJson): string {
    return serializeState(data)
  }

  // =========== Current Task ===========

  async getCurrentTask(projectId: string): Promise<CurrentTask | null> {
    const state = await this.read(projectId)
    return state.currentTask
  }

  async setCurrentTask(projectId: string, task: CurrentTask | null): Promise<StateJson> {
    return this.update(projectId, (state) => ({
      ...state,
      currentTask: task,
      lastUpdated: new Date().toISOString()
    }))
  }

  async startTask(
    projectId: string,
    task: Omit<CurrentTask, 'startedAt'>
  ): Promise<StateJson> {
    const currentTask: CurrentTask = {
      ...task,
      startedAt: new Date().toISOString()
    }

    return this.update(projectId, () => ({
      currentTask,
      lastUpdated: new Date().toISOString()
    }))
  }

  async completeTask(projectId: string): Promise<StateJson> {
    const state = await this.read(projectId)
    if (!state.currentTask) {
      throw new Error('No active task to complete')
    }

    return this.update(projectId, () => ({
      currentTask: null,
      lastUpdated: new Date().toISOString()
    }))
  }

  async pauseTask(projectId: string): Promise<StateJson> {
    const state = await this.read(projectId)
    if (!state.currentTask) {
      throw new Error('No active task to pause')
    }

    const previousTask: PreviousTask = {
      id: state.currentTask.id,
      description: state.currentTask.description,
      status: 'paused',
      startedAt: state.currentTask.startedAt,
      pausedAt: new Date().toISOString()
    }

    return this.update(projectId, () => ({
      currentTask: null,
      previousTask,
      lastUpdated: new Date().toISOString()
    }))
  }

  async resumeTask(projectId: string): Promise<StateJson> {
    const state = await this.read(projectId)
    if (!state.previousTask) {
      throw new Error('No paused task to resume')
    }

    const currentTask: CurrentTask = {
      id: state.previousTask.id,
      description: state.previousTask.description,
      startedAt: new Date().toISOString(), // Reset start time
      sessionId: `sess_${Date.now()}`
    }

    return this.update(projectId, () => ({
      currentTask,
      previousTask: null,
      lastUpdated: new Date().toISOString()
    }))
  }

  async clearTask(projectId: string): Promise<StateJson> {
    return this.update(projectId, () => ({
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
}

export const mdStateManager = new MdStateManager()
export default mdStateManager
