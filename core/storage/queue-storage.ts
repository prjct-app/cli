/**
 * Queue Storage
 *
 * Manages task queue via storage/queue.json
 * Generates context/next.md for Claude
 */

import { generateUUID } from '../schemas/schemas'
import type { Priority, QueueJson, QueueTask, TaskSection } from '../schemas/state'
import { QueueJsonSchema } from '../schemas/state'
import { sortBySectionAndPriority } from '../utils/collection-filters'
import { getDaysAgo, getTimestamp } from '../utils/date-helper'
import { ARCHIVE_POLICIES, archiveStorage } from './archive-storage'
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

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `queue.${action}d`
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
    return sortBySectionAndPriority(tasks)[0] || null
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
   * Get a single task by ID
   */
  async getTask(projectId: string, taskId: string): Promise<QueueTask | null> {
    const queue = await this.read(projectId)
    return queue.tasks.find((t) => t.id === taskId) || null
  }

  /**
   * Update task fields (description, body, type, priority, section)
   */
  async updateTask(
    projectId: string,
    taskId: string,
    updates: Partial<Pick<QueueTask, 'description' | 'body' | 'type' | 'priority' | 'section'>>
  ): Promise<QueueTask | null> {
    let updated: QueueTask | null = null

    await this.update(projectId, (queue) => ({
      tasks: queue.tasks.map((t) => {
        if (t.id === taskId) {
          updated = { ...t, ...updates }
          return updated
        }
        return t
      }),
      lastUpdated: getTimestamp(),
    }))

    if (updated) {
      await this.publishEvent(projectId, 'queue.task_updated', { taskId })
    }

    return updated
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
   * Remove completed tasks older than retention period (PRJ-267).
   * Archives them to SQLite before removal.
   * Returns count of removed tasks.
   */
  async removeStaleCompleted(projectId: string): Promise<number> {
    const queue = await this.read(projectId)
    const threshold = getDaysAgo(ARCHIVE_POLICIES.QUEUE_COMPLETED_DAYS)

    const stale = queue.tasks.filter(
      (t) => t.completed && t.completedAt && new Date(t.completedAt) < threshold
    )

    if (stale.length === 0) return 0

    // Archive before removal
    archiveStorage.archiveMany(
      projectId,
      stale.map((t) => ({
        entityType: 'queue_task' as const,
        entityId: t.id,
        entityData: t,
        summary: t.description,
        reason: 'age',
      }))
    )

    const staleIds = new Set(stale.map((t) => t.id))

    await this.update(projectId, (q) => ({
      tasks: q.tasks.filter((t) => !staleIds.has(t.id)),
      lastUpdated: getTimestamp(),
    }))

    await this.publishEvent(projectId, 'queue.stale_removed', {
      count: stale.length,
    })

    return stale.length
  }
}

export const queueStorage = new QueueStorage()
export default queueStorage
