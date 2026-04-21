/**
 * Workflow Rule Storage (Phase 2)
 *
 * CRUD operations for workflow_rules table.
 * Stores hooks, gates, and custom steps per project.
 */

import type { WorkflowRule } from '../types/storage.js'
import { customWorkflowStorage } from './custom-workflow-storage'
import { prjctDb, type SqliteBindings } from './database'

interface WorkflowRuleRow {
  id: number
  type: string
  command: string
  position: string
  action: string
  description: string | null
  enabled: number
  timeout_ms: number
  created_at: string
  sort_order: number
  when_expr: string | null
  parallel: number | null
  trust_source: string | null
}

function rowToRule(row: WorkflowRuleRow): WorkflowRule {
  const trustSource: WorkflowRule['trustSource'] =
    row.trust_source === 'imported' ? 'imported' : 'local'
  return {
    id: row.id,
    type: row.type as WorkflowRule['type'],
    command: row.command,
    position: row.position,
    action: row.action,
    description: row.description,
    enabled: row.enabled === 1,
    timeoutMs: row.timeout_ms,
    createdAt: row.created_at,
    sortOrder: row.sort_order,
    whenExpr: row.when_expr ?? null,
    parallel: row.parallel === null ? true : row.parallel === 1,
    trustSource,
  }
}

// v2 additions (whenExpr/parallel/trustSource) are optional on the insert
// path so pre-v2 call sites like the seed ship workflow keep compiling.
// Defaults: no condition, parallel=true, trustSource='local'.
type NewRuleInput = Omit<WorkflowRule, 'id' | 'whenExpr' | 'parallel' | 'trustSource'> &
  Partial<Pick<WorkflowRule, 'whenExpr' | 'parallel' | 'trustSource'>>

class WorkflowRuleStorage {
  addRule(projectId: string, rule: NewRuleInput): number {
    const maxOrder = prjctDb.get<{ m: number | null }>(
      projectId,
      'SELECT MAX(sort_order) as m FROM workflow_rules WHERE command = ?',
      rule.command
    )
    const sortOrder = rule.sortOrder || (maxOrder?.m ?? -1) + 1

    prjctDb.run(
      projectId,
      `INSERT INTO workflow_rules (type, command, position, action, description, enabled, timeout_ms, created_at, sort_order, when_expr, parallel, trust_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      rule.type,
      rule.command,
      rule.position,
      rule.action,
      rule.description ?? null,
      rule.enabled ? 1 : 0,
      rule.timeoutMs,
      rule.createdAt,
      sortOrder,
      rule.whenExpr ?? null,
      rule.parallel === false ? 0 : 1,
      rule.trustSource ?? 'local'
    )

    const inserted = prjctDb.get<{ id: number }>(projectId, 'SELECT last_insert_rowid() as id')
    return inserted?.id ?? 0
  }

  removeRule(projectId: string, ruleId: number): boolean {
    const existing = prjctDb.get<WorkflowRuleRow>(
      projectId,
      'SELECT id FROM workflow_rules WHERE id = ?',
      ruleId
    )
    if (!existing) return false

    prjctDb.run(projectId, 'DELETE FROM workflow_rules WHERE id = ?', ruleId)
    return true
  }

  updateRule(
    projectId: string,
    ruleId: number,
    updates: Partial<Omit<WorkflowRule, 'id'>>
  ): boolean {
    const existing = prjctDb.get<WorkflowRuleRow>(
      projectId,
      'SELECT id FROM workflow_rules WHERE id = ?',
      ruleId
    )
    if (!existing) return false

    const fieldMap: Record<
      string,
      { column: string; transform?: (v: SqliteBindings) => SqliteBindings }
    > = {
      type: { column: 'type' },
      command: { column: 'command' },
      position: { column: 'position' },
      action: { column: 'action' },
      description: { column: 'description' },
      enabled: { column: 'enabled', transform: (v: SqliteBindings) => (v ? 1 : 0) },
      timeoutMs: { column: 'timeout_ms' },
      createdAt: { column: 'created_at' },
      sortOrder: { column: 'sort_order' },
      whenExpr: { column: 'when_expr' },
      parallel: { column: 'parallel', transform: (v: SqliteBindings) => (v === false ? 0 : 1) },
      trustSource: { column: 'trust_source' },
    }

    const setClauses: string[] = []
    const values: SqliteBindings[] = []

    for (const [key, value] of Object.entries(updates)) {
      const mapping = fieldMap[key]
      if (!mapping) continue
      setClauses.push(`${mapping.column} = ?`)
      const bindValue = value as SqliteBindings
      values.push(mapping.transform ? mapping.transform(bindValue) : bindValue)
    }

    if (setClauses.length === 0) return true

    values.push(ruleId)
    prjctDb.run(
      projectId,
      `UPDATE workflow_rules SET ${setClauses.join(', ')} WHERE id = ?`,
      ...values
    )
    return true
  }

  getRuleById(projectId: string, ruleId: number): WorkflowRule | null {
    const row = prjctDb.get<WorkflowRuleRow>(
      projectId,
      'SELECT * FROM workflow_rules WHERE id = ?',
      ruleId
    )
    return row ? rowToRule(row) : null
  }

  getRulesForCommand(projectId: string, command: string): WorkflowRule[] {
    // Validate workflow exists and is enabled
    const workflow = customWorkflowStorage.getWorkflow(projectId, command)
    if (!workflow || !workflow.enabled) {
      return []
    }

    const rows = prjctDb.query<WorkflowRuleRow>(
      projectId,
      'SELECT * FROM workflow_rules WHERE command = ? AND enabled = 1 ORDER BY sort_order ASC',
      command
    )
    return rows.map(rowToRule)
  }

  getAllRules(projectId: string): WorkflowRule[] {
    const rows = prjctDb.query<WorkflowRuleRow>(
      projectId,
      'SELECT * FROM workflow_rules ORDER BY command ASC, sort_order ASC'
    )
    return rows.map(rowToRule)
  }

  resetRules(projectId: string): number {
    const count = prjctDb.get<{ c: number }>(projectId, 'SELECT COUNT(*) as c FROM workflow_rules')
    prjctDb.run(projectId, 'DELETE FROM workflow_rules')
    return count?.c ?? 0
  }
}

export const workflowRuleStorage = new WorkflowRuleStorage()
