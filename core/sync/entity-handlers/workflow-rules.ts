/**
 * Workflow-rules entity handler — applies a pulled `workflow_rules` event
 * (the hooks/gates/steps that belong to a custom workflow).
 *
 * Remote numeric IDs live in a disjoint negative namespace. Pulled rules are
 * always inert and imported: cloud data may describe a workflow, but only a
 * local explicit add/enable action may make executable policy active.
 */

import prjctDb from '../../storage/database'
import type { EntityHandler } from './types'

export const workflowRulesHandler: EntityHandler = {
  async upsert(projectId, data) {
    const id = Number(data.id)
    if (!Number.isSafeInteger(id) || id <= 0) return
    const importedId = -id

    prjctDb.transaction(projectId, (db) => {
      db.prepare(
        `INSERT INTO workflow_rules
           (id, type, command, position, action, description, enabled, timeout_ms,
            created_at, sort_order, when_expr, parallel, trust_source)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'imported')
         ON CONFLICT(id) DO UPDATE SET
           type = excluded.type,
           command = excluded.command,
           position = excluded.position,
           action = excluded.action,
           description = excluded.description,
           enabled = 0,
           timeout_ms = excluded.timeout_ms,
           sort_order = excluded.sort_order,
           when_expr = excluded.when_expr,
           parallel = excluded.parallel,
           trust_source = 'imported'`
      ).run(
        importedId,
        (data.type as string) || 'step',
        (data.command as string) || '',
        (data.position as string) || '',
        (data.action as string) || '',
        (data.description as string) ?? null,
        typeof data.timeout_ms === 'number' ? data.timeout_ms : 0,
        (data.created_at as string) || new Date().toISOString(),
        typeof data.sort_order === 'number' ? data.sort_order : 0,
        (data.when_expr as string) ?? null,
        data.parallel === 0 ? 0 : 1
      )

      // Older clients stored imported rows in the positive local namespace.
      // Converge imported rows only; a colliding local rule is never touched.
      db.prepare("DELETE FROM workflow_rules WHERE id = ? AND trust_source = 'imported'").run(id)
    })
  },

  async delete(_projectId, _data) {
    // No-op by design: sync never deletes or modifies a local record.
  },
}
