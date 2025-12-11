/**
 * MD Queue Manager
 *
 * MD-First Architecture: Manages queue via next.md.
 * Source of truth is the markdown file, not JSON.
 */

import { MdBaseManager } from './md-base-manager'
import { parseQueue, serializeQueue } from '../serializers'
import type { QueueJson, QueueTask, Priority, TaskType, TaskSection } from '../schemas/state'

class MdQueueManager extends MdBaseManager<QueueJson> {
  constructor() {
    super('core/next.md')
  }

  protected getDefault(): QueueJson {
    return {
      tasks: [],
      lastUpdated: new Date().toISOString().split('T')[0]
    }
  }

  protected parse(content: string): QueueJson {
    return parseQueue(content)
  }

  protected serialize(data: QueueJson): string {
    return serializeQueue(data)
  }

  // =========== Queue Operations ===========

  async getTasks(projectId: string): Promise<QueueTask[]> {
    const queue = await this.read(projectId)
    return queue.tasks
  }

  async getActiveTasks(projectId: string): Promise<QueueTask[]> {
    const queue = await this.read(projectId)
    return queue.tasks.filter(t => t.section === 'active' && !t.completed)
  }

  async getBacklog(projectId: string): Promise<QueueTask[]> {
    const queue = await this.read(projectId)
    return queue.tasks.filter(t => t.section === 'backlog' && !t.completed)
  }

  async addTask(
    projectId: string,
    task: Omit<QueueTask, 'id' | 'createdAt' | 'completed'>
  ): Promise<QueueJson> {
    const newTask: QueueTask = {
      ...task,
      id: `task_${Date.now()}`,
      createdAt: new Date().toISOString(),
      completed: false
    }

    return this.update(projectId, (queue) => ({
      tasks: this.sortTasks([...queue.tasks, newTask]),
      lastUpdated: new Date().toISOString().split('T')[0]
    }))
  }

  async removeTask(projectId: string, taskId: string): Promise<QueueJson> {
    return this.update(projectId, (queue) => ({
      tasks: queue.tasks.filter(t => t.id !== taskId),
      lastUpdated: new Date().toISOString().split('T')[0]
    }))
  }

  async completeTask(projectId: string, taskId: string): Promise<QueueJson> {
    return this.update(projectId, (queue) => ({
      tasks: queue.tasks.map(t =>
        t.id === taskId
          ? { ...t, completed: true, completedAt: new Date().toISOString() }
          : t
      ),
      lastUpdated: new Date().toISOString().split('T')[0]
    }))
  }

  async getNextTask(projectId: string): Promise<QueueTask | null> {
    const queue = await this.read(projectId)
    return queue.tasks.find(t => t.section === 'active' && !t.completed) || null
  }

  async moveToSection(
    projectId: string,
    taskId: string,
    section: TaskSection
  ): Promise<QueueJson> {
    return this.update(projectId, (queue) => ({
      tasks: queue.tasks.map(t =>
        t.id === taskId ? { ...t, section } : t
      ),
      lastUpdated: new Date().toISOString().split('T')[0]
    }))
  }

  async setPriority(
    projectId: string,
    taskId: string,
    priority: Priority
  ): Promise<QueueJson> {
    return this.update(projectId, (queue) => ({
      tasks: this.sortTasks(
        queue.tasks.map(t => t.id === taskId ? { ...t, priority } : t)
      ),
      lastUpdated: new Date().toISOString().split('T')[0]
    }))
  }

  /**
   * Add multiple tasks at once (e.g., from a feature breakdown)
   */
  async addTasks(
    projectId: string,
    tasks: Array<Omit<QueueTask, 'id' | 'createdAt' | 'completed'>>
  ): Promise<QueueJson> {
    const newTasks: QueueTask[] = tasks.map((task, i) => ({
      ...task,
      id: `task_${Date.now()}_${i}`,
      createdAt: new Date().toISOString(),
      completed: false
    }))

    return this.update(projectId, (queue) => ({
      tasks: this.sortTasks([...queue.tasks, ...newTasks]),
      lastUpdated: new Date().toISOString().split('T')[0]
    }))
  }

  /**
   * Clear completed tasks
   */
  async clearCompleted(projectId: string): Promise<QueueJson> {
    return this.update(projectId, (queue) => ({
      tasks: queue.tasks.filter(t => !t.completed),
      lastUpdated: new Date().toISOString().split('T')[0]
    }))
  }

  /**
   * Sort tasks by priority then by creation date
   */
  private sortTasks(tasks: QueueTask[]): QueueTask[] {
    const priorityOrder: Record<Priority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    }

    return tasks.sort((a, b) => {
      // First by section (active first)
      const sectionOrder: Record<TaskSection, number> = {
        active: 0,
        previously_active: 1,
        backlog: 2
      }
      if (sectionOrder[a.section] !== sectionOrder[b.section]) {
        return sectionOrder[a.section] - sectionOrder[b.section]
      }

      // Then by priority
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }

      // Finally by creation date
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }
}

export const mdQueueManager = new MdQueueManager()
export default mdQueueManager
