/**
 * Crew Checkpoints Storage
 *
 * Single kv_store row at key `crew:checkpoints` per project. Source of
 * truth for the reviewer subagent's gate criteria, replacing the legacy
 * `.prjct/CHECKPOINTS.md` file write. The reviewer template gets the
 * current content spliced into a marker region at install time — no
 * disk read at run time.
 *
 * See spec a50b32d1 AC #7.
 */

import { z } from 'zod'
import { getTemplateContent } from '../agentic/template-loader'
import { getTimestamp } from '../utils/date-helper'
import prjctDb from './database'

export const CHECKPOINTS_KEY = 'crew:checkpoints'

const BUNDLED_TEMPLATE_KEY = 'crew/CHECKPOINTS.md'

export const CheckpointsRowSchema = z.object({
  content: z.string(),
  source: z.enum(['default', 'user', 'migrated']),
  updated_at: z.string().min(1),
})

export type CheckpointsRow = z.infer<typeof CheckpointsRowSchema>

/**
 * Read the bundled default CHECKPOINTS content from the templates
 * bundle. Throws if the template is missing (the bundle is required
 * for crew mode to work at all — a missing template is a build error).
 */
export function getBundledDefault(): string {
  const content = getTemplateContent(BUNDLED_TEMPLATE_KEY)
  if (!content) {
    throw new Error(`Missing bundled crew checkpoints template: ${BUNDLED_TEMPLATE_KEY}`)
  }
  return content
}

class CheckpointsStorage {
  /**
   * Get the user's current checkpoints content. If no row exists,
   * returns the bundled default with `source='default'`.
   */
  get(projectId: string): CheckpointsRow {
    const raw = prjctDb.getDoc<unknown>(projectId, CHECKPOINTS_KEY)
    if (raw === null) {
      return {
        content: getBundledDefault(),
        source: 'default',
        updated_at: getTimestamp(),
      }
    }
    return CheckpointsRowSchema.parse(raw)
  }

  /**
   * Returns true if a user-set or migrated row exists; false if the
   * caller would receive the bundled default on get().
   */
  hasCustomization(projectId: string): boolean {
    return prjctDb.hasDoc(projectId, CHECKPOINTS_KEY)
  }

  set(projectId: string, content: string, source: 'user' | 'migrated' = 'user'): CheckpointsRow {
    const row: CheckpointsRow = {
      content,
      source,
      updated_at: getTimestamp(),
    }
    prjctDb.setDoc(projectId, CHECKPOINTS_KEY, row)
    return row
  }

  /**
   * Reset to the bundled default. Removes the kv_store row entirely
   * (subsequent get() returns the freshly-resolved bundled content),
   * which keeps the DB row count low and avoids drift if the bundled
   * default ever changes in a future release.
   */
  reset(projectId: string): void {
    prjctDb.deleteDoc(projectId, CHECKPOINTS_KEY)
  }
}

export const checkpointsStorage = new CheckpointsStorage()
export default checkpointsStorage
