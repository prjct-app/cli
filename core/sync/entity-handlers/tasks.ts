/**
 * Tasks entity handler.
 *
 * Tasks have a small state machine — `currentTask` lives at most
 * one slot in `state.json`, while completed/queued tasks live in
 * the queue or the events log. The `upsert` path:
 *   - completed/shipped status → clear `currentTask` if it matches
 *     (the delete-equivalent for tasks; history stays in `events`).
 *   - active status (or has `started_at`) → replace `currentTask`
 *     by id (no append).
 *   - other status → upsert into queue by id.
 */

import type { Priority, TaskSection, TaskType } from '../../schemas/state'
import { queueStorage } from '../../storage/queue-storage'
import { stateStorage } from '../../storage/state-storage'
import type { EntityHandler } from './types'

export const tasksHandler: EntityHandler = {
  async upsert(projectId, data) {
    const id = (data.id as string) || ''
    if (!id) return
    const status = (data.status as string) || ''

    if (status === 'completed' || status === 'shipped') {
      await stateStorage.update(projectId, (state) => {
        if (state.currentTask?.id === id) {
          return { ...state, currentTask: null }
        }
        return state
      })
      return
    }

    if (status === 'active' || data.started_at || data.startedAt) {
      await stateStorage.update(projectId, (state) => ({
        ...state,
        currentTask: {
          id,
          description: data.description as string,
          startedAt:
            (data.started_at as string) || (data.startedAt as string) || new Date().toISOString(),
          sessionId: (data.session_id as string) || (data.sessionId as string) || '',
        },
      }))
      return
    }

    await queueStorage.update(projectId, (queue) => {
      const existingIdx = queue.tasks.findIndex((t) => t.id === id)
      const next = {
        id,
        description: data.description as string,
        priority: (data.priority as Priority) || 'medium',
        type: (data.type as TaskType) || 'feature',
        section: 'backlog' as TaskSection,
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
    await stateStorage.update(projectId, (state) => {
      if (state.currentTask?.id === id) {
        return { ...state, currentTask: null }
      }
      return state
    })
  },
}
