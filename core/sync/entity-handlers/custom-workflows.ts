/**
 * Custom-workflows entity handler — applies a pulled `custom_workflows` event.
 *
 * Identity is the workflow `name` (unique, human-chosen), NOT the local
 * autoincrement id which differs per machine. Built-in workflows
 * (task/done/ship/sync) are never touched. Writes directly to the table —
 * no `customWorkflowStorage` call, which would re-publish and echo.
 */

import prjctDb from '../../storage/database'
import type { ApplyData, EntityHandler } from './types'

export const customWorkflowsHandler: EntityHandler = {
  async upsert(projectId, data) {
    const name = (data.name as string) || ''
    if (!name) return

    const description = (data.description as string) ?? null
    const metadata = serializeMetadata(data.metadata)
    const now = new Date().toISOString()

    const existing = prjctDb.get<{ id: number; is_builtin: number }>(
      projectId,
      'SELECT id, is_builtin FROM custom_workflows WHERE name = ?',
      name
    )

    if (existing) {
      // Never overwrite a built-in definition.
      if (existing.is_builtin === 1) return
      prjctDb.run(
        projectId,
        'UPDATE custom_workflows SET description = ?, metadata = ?, updated_at = ? WHERE name = ? AND is_builtin = 0',
        description,
        metadata,
        now,
        name
      )
      return
    }

    prjctDb.run(
      projectId,
      `INSERT INTO custom_workflows (name, description, created_at, updated_at, is_builtin, enabled, metadata)
       VALUES (?, ?, ?, ?, 0, 0, ?)`,
      name,
      description,
      (data.created_at as string) || now,
      now,
      metadata
    )
  },

  async delete(_projectId, _data) {
    // No-op by design: sync never deletes or modifies a local record.
  },
}

/** metadata arrives as an object (round-tripped) or null; store as JSON text. */
function serializeMetadata(value: ApplyData['metadata']): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}
