/**
 * Workflow-rules entity handler — applies a pulled `workflow_rules` event
 * (the hooks/gates/steps that belong to a custom workflow).
 *
 * These rows have an autoincrement id with no natural key, so we mirror by
 * the source id via `INSERT OR REPLACE` — exactly the upsert-by-id model the
 * cloud spec defines (the server preserves the CLI's id). Last-write-wins is
 * the accepted v1 conflict policy; two machines creating distinct rules
 * offline could collide on an id (rare, low-churn config) — documented
 * limitation, resolved later by a stable-id migration. Writes directly (no
 * `workflowRuleStorage` call → no echo).
 */

import prjctDb from '../../storage/database'
import type { EntityHandler } from './types'

export const workflowRulesHandler: EntityHandler = {
  async upsert(projectId, data) {
    const id = Number(data.id)
    if (!Number.isFinite(id) || id <= 0) return

    prjctDb.run(
      projectId,
      `INSERT OR REPLACE INTO workflow_rules
         (id, type, command, position, action, description, enabled, timeout_ms,
          created_at, sort_order, when_expr, parallel, trust_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      (data.type as string) || 'step',
      (data.command as string) || '',
      (data.position as string) || '',
      (data.action as string) || '',
      (data.description as string) ?? null,
      data.enabled === 0 ? 0 : 1,
      typeof data.timeout_ms === 'number' ? data.timeout_ms : 0,
      (data.created_at as string) || new Date().toISOString(),
      typeof data.sort_order === 'number' ? data.sort_order : 0,
      (data.when_expr as string) ?? null,
      data.parallel === 0 ? 0 : 1,
      (data.trust_source as string) || 'imported'
    )
  },

  async delete(_projectId, _data) {
    // No-op by design: sync never deletes or modifies a local record.
  },
}
