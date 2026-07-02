/**
 * Queue tasks entity handler.
 *
 * Upsert by id into the queue's tasks array; delete drops the entry.
 * Legacy events without an id fall back to append (preserves
 * pre-1.5 behavior; new B1-instrumented producers always carry id).
 */

import type { Priority, TaskSection, TaskType } from '../../schemas/state'
import { queueStorage } from '../../storage/queue-storage'
import type { EntityHandler } from './types'

export const queueTasksHandler: EntityHandler = {
  async upsert(projectId, data) {
    // A queue task with no description is unusable by every consumer — and
    // persisting `|| ''` here is exactly what polluted the legacy blob with
    // 6,046 empty rows (of 6,105 total on the reference project): wire events
    // lacking `description` each landed as an empty backlog task. Skip them.
    const description = (data.description as string) || ''
    if (!description.trim()) return

    const id = (data.id as string) || ''
    if (!id) {
      await queueStorage.addTask(projectId, {
        description,
        priority: (data.priority as Priority) || 'medium',
        type: (data.type as TaskType) || 'feature',
        section: (data.section as TaskSection) || 'backlog',
      })
      return
    }

    // Pass ONLY fields the wire actually carried — fabricated defaults on an
    // UPDATE clobber local state (upsertTask supplies defaults on INSERT).
    await queueStorage.upsertTask(projectId, {
      id,
      description,
      ...(data.priority ? { priority: data.priority as Priority } : {}),
      ...(data.type ? { type: data.type as TaskType } : {}),
      ...(data.section ? { section: data.section as TaskSection } : {}),
    })
  },

  async delete(_projectId, _data) {
    // No-op by design: sync never deletes or modifies a local record.
  },
}
