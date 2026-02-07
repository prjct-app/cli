/**
 * Queue Storage
 *
 * Manages task queue via storage/queue.json
 * Generates context/next.md for Claude
 */

import { generateUUID } from '../schemas'
import type { Priority, QueueJson, QueueTask, TaskSection } from '../schemas/state'
import { QueueJsonSchema } from '../schemas/state'
import { getTimestamp } from '../utils/date-helper'
import { StorageManager } from './storage-manager'

class QueueStorage extends StorageManager<QueueJson> {
  constructor() {
    super('queue.json', QueueJsonSchema)
  }

  protected getDefault(): QueueJson {
    return {
      tasks: [],
      lastUpdated: '',
    }
  }

  protected getMdFilename(): string {
    return 'next.md'
  }

  protected getLayer(): string {
    return 'core'
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `queue.${action}d`
  }

  protected toMarkdown(data: QueueJson): string {
    const lines = ['# Priority Queue', '']

    const activeTasks = data.tasks.filter((t) => t.section === 'active' && !t.completed)
    const backlogTasks = data.tasks.filter((t) => t.section === 'backlog' && !t.completed)
    const previouslyActive = data.tasks.filter(
      (t) => t.section === 'previously_active' && !t.completed
    )

    // Active section
    lines.push('## Active Tasks')
    if (activeTasks.length > 0) {
      activeTasks.forEach((task, i) => {
        const checkbox = task.completed ? '[x]' : '[ ]'
        const priority = task.priority !== 'medium' ? ` [${task.priority.toUpperCase()}]` : ''
        const agent = task.agent ? ` @${task.agent}` : ''
        const origin = task.originFeature ? ` (from: ${task.originFeature})` : ''
        const bug = task.type === 'bug' ? ' \u{1F41B}' : ''
        lines.push(`${i + 1}. ${checkbox}${bug}${priority} ${task.description}${agent}${origin}`)
      })
    } else {
      lines.push('_No active tasks_')
    }
    lines.push('')

    // Previously active section (if any)
    if (previouslyActive.length > 0) {
      lines.push('## Previously Active')
      previouslyActive.forEach((task) => {
        lines.push(`- [ ] ${task.description}`)
      })
      lines.push('')
    }

    // Backlog section
    lines.push('## Backlog')
    if (backlogTasks.length > 0) {
      backlogTasks.forEach((task) => {
        const priority = task.priority !== 'medium' ? ` [${task.priority.toUpperCase()}]` : ''
        const bug = task.type === 'bug' ? ' \u{1F41B}' : ''
        lines.push(`- [ ]${bug}${priority} ${task.description}`)
      })
    } else {
      lines.push('_No backlog items_')
    }
    lines.push('')

    return lines.join('\n')
  }

  // =========== Domain Methods ===========

  /**
   * Get all tasks
   */
  async getTasks(projectId: string): Promise<QueueTask[]> {
    const queue = await this.read(projectId)
    return queue.tasks
  }

  /**
   * Get active (non-backlog) tasks
   */
  async getActiveTasks(projectId: string): Promise<QueueTask[]> {
    const queue = await this.read(projectId)
    return queue.tasks.filter((t) => t.section === 'active' && !t.completed)
  }

  /**
   * Get backlog tasks
   */
  async getBacklog(projectId: string): Promise<QueueTask[]> {
    const queue = await this.read(projectId)
    return queue.tasks.filter((t) => t.section === 'backlog' && !t.completed)
  }

  /**
   * Get next task (highest priority incomplete)
   */
  async getNextTask(projectId: string): Promise<QueueTask | null> {
    const tasks = await this.getActiveTasks(projectId)
    return this.sortTasks(tasks)[0] || null
  }

  /**
   * Add a task to the queue
   */
  async addTask(
    projectId: string,
    task: Omit<QueueTask, 'id' | 'createdAt' | 'completed' | 'completedAt'>
  ): Promise<QueueTask> {
    const newTask: QueueTask = {
      ...task,
      id: generateUUID(),
      createdAt: getTimestamp(),
      completed: false,
    }

    await this.update(projectId, (queue) => ({
      tasks: [...queue.tasks, newTask],
      lastUpdated: getTimestamp(),
    }))

    // Publish incremental event
    await this.publishEvent(projectId, 'queue.task_added', {
      taskId: newTask.id,
      description: newTask.description,
      priority: newTask.priority,
      section: newTask.section,
    })

    return newTask
  }

  /**
   * Add multiple tasks
   */
  async addTasks(
    projectId: string,
    tasks: Omit<QueueTask, 'id' | 'createdAt' | 'completed' | 'completedAt'>[]
  ): Promise<QueueTask[]> {
    const now = getTimestamp()
    const newTasks: QueueTask[] = tasks.map((task) => ({
      ...task,
      id: generateUUID(),
      createdAt: now,
      completed: false,
    }))

    await this.update(projectId, (queue) => ({
      tasks: [...queue.tasks, ...newTasks],
      lastUpdated: now,
    }))

    // Publish event for batch add
    await this.publishEvent(projectId, 'queue.tasks_added', {
      count: newTasks.length,
      tasks: newTasks.map((t) => ({ id: t.id, description: t.description })),
    })

    return newTasks
  }

  /**
   * Remove a task
   */
  async removeTask(projectId: string, taskId: string): Promise<void> {
    await this.update(projectId, (queue) => ({
      tasks: queue.tasks.filter((t) => t.id !== taskId),
      lastUpdated: getTimestamp(),
    }))

    await this.publishEvent(projectId, 'queue.task_removed', { taskId })
  }

  /**
   * Mark a task as completed
   */
  async completeTask(projectId: string, taskId: string): Promise<QueueTask | null> {
    let completedTask: QueueTask | null = null

    await this.update(projectId, (queue) => {
      const tasks = queue.tasks.map((t) => {
        if (t.id === taskId) {
          completedTask = {
            ...t,
            completed: true,
            completedAt: getTimestamp(),
          }
          return completedTask
        }
        return t
      })
      return { tasks, lastUpdated: getTimestamp() }
    })

    if (completedTask) {
      const task = completedTask as QueueTask
      await this.publishEvent(projectId, 'queue.task_completed', {
        taskId,
        description: task.description,
        completedAt: task.completedAt,
      })
    }

    return completedTask
  }

  /**
   * Move task to different section
   */
  async moveToSection(projectId: string, taskId: string, section: TaskSection): Promise<void> {
    await this.update(projectId, (queue) => ({
      tasks: queue.tasks.map((t) => (t.id === taskId ? { ...t, section } : t)),
      lastUpdated: getTimestamp(),
    }))
  }

  /**
   * Set task priority
   */
  async setPriority(projectId: string, taskId: string, priority: Priority): Promise<void> {
    await this.update(projectId, (queue) => ({
      tasks: queue.tasks.map((t) => (t.id === taskId ? { ...t, priority } : t)),
      lastUpdated: getTimestamp(),
    }))
  }

  /**
   * Clear completed tasks
   */
  async clearCompleted(projectId: string): Promise<number> {
    const queue = await this.read(projectId)
    const completedCount = queue.tasks.filter((t) => t.completed).length

    await this.update(projectId, (q) => ({
      tasks: q.tasks.filter((t) => !t.completed),
      lastUpdated: getTimestamp(),
    }))

    return completedCount
  }

  /**
   * Sort tasks by priority and section
   */
  private sortTasks(tasks: QueueTask[]): QueueTask[] {
    const priorityOrder: Record<Priority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    }

    const sectionOrder: Record<TaskSection, number> = {
      active: 0,
      previously_active: 1,
      backlog: 2,
    }

    return [...tasks].sort((a, b) => {
      // Section first
      const sectionDiff = sectionOrder[a.section] - sectionOrder[b.section]
      if (sectionDiff !== 0) return sectionDiff

      // Then priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff

      // Then creation date
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }
}

export const queueStorage = new QueueStorage()
export default queueStorage
