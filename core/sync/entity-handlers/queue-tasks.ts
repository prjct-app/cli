/**
 * Queue tasks entity handler.
 *
 * Upsert by id into the queue's tasks array; delete drops the entry.
 * Legacy events without an id fall back to append (preserves
 * pre-1.5 behavior; new B1-instrumented producers always carry id).
 */

import type { Priority, TaskSection, TaskType } from '../../schemas/state'
import { queueStorage } from '../../storage/queue-storage'
import type { ApplyData, EntityHandler } from './types'

export const queueTasksHandler: EntityHandler = {
  async upsert(projectId, data) {
    const id = (data.id as string) || ''
    if (!id) {
      await queueStorage.addTask(projectId, {
        description: (data.description as string) || '',
        priority: (data.priority as Priority) || 'medium',
        type: (data.type as TaskType) || 'feature',
        section: (data.section as TaskSection) || 'backlog',
      })
      return
    }

    await queueStorage.update(projectId, (queue) => {
      const existingIdx = queue.tasks.findIndex((t) => t.id === id)
      const next = {
        id,
        description: (data.description as string) || '',
        priority: (data.priority as Priority) || 'medium',
        type: (data.type as TaskType) || 'feature',
        section: (data.section as TaskSection) || 'backlog',
      } as (typeof queue.tasks)[number]
      const tasks =
        existingIdx >= 0
          ? queue.tasks.map((t, i) => (i === existingIdx ? { ...t, ...next } : t))
          : [...queue.tasks, next]
      return { ...queue, tasks }
    })
  },

  async delete(projectId, data) {
    const id = (data.id as string) || ''
    if (!id) return
    await queueStorage.update(projectId, (queue) => ({
      ...queue,
      tasks: queue.tasks.filter((t) => t.id !== id),
    }))
  },
}
