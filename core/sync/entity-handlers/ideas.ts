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
    // Same guard as the queue handlers: an empty text is garbage in.
    if (!text.trim()) return
    const priority = (data.priority as IdeaPriority) || 'medium'
    const status = (data.status as string) || 'active'

    await ideasStorage.upsertIdea(projectId, {
      id,
      text,
      priority,
      status: status === 'archived' ? 'archived' : 'pending',
      addedAt: (data.created_at as string) ?? (data.addedAt as string) ?? new Date().toISOString(),
    })
  },

  async delete(_projectId, _data) {
    // No-op by design: sync never deletes or modifies a local record.
  },
}
