/**
 * Ideas entity handler.
 *
 * Ideas are upsert-by-id into a flat array. Delete is a soft-delete
 * (status='archived') so the history survives.
 */

import type { IdeaPriority } from '../../schemas/ideas'
import { ideasStorage } from '../../storage/ideas-storage'
import type { EntityHandler } from './types'

export const ideasHandler: EntityHandler = {
  async upsert(projectId, data) {
    const id = (data.id as string) || ''
    if (!id) return
    const text = (data.title as string) || (data.text as string) || ''
    const priority = (data.priority as IdeaPriority) || 'medium'
    const status = (data.status as string) || 'active'

    await ideasStorage.update(projectId, (ideas) => {
      const existingIdx = ideas.ideas.findIndex((i) => i.id === id)
      const desiredStatus = status === 'archived' ? ('archived' as const) : ('pending' as const)
      const next = {
        id,
        text,
        priority,
        status: desiredStatus,
        addedAt: ideas.ideas[existingIdx]?.addedAt ?? new Date().toISOString(),
        tags: ideas.ideas[existingIdx]?.tags ?? [],
      } as (typeof ideas.ideas)[number]
      const list =
        existingIdx >= 0
          ? ideas.ideas.map((i, idx) => (idx === existingIdx ? { ...i, ...next } : i))
          : [...ideas.ideas, next]
      return { ...ideas, ideas: list }
    })
  },

  async delete(projectId, data) {
    const id = (data.id as string) || ''
    if (!id) return
    await ideasStorage.update(projectId, (ideas) => ({
      ...ideas,
      ideas: ideas.ideas.map((idea) =>
        idea.id === id ? { ...idea, status: 'archived' as const } : idea
      ),
    }))
  },
}
