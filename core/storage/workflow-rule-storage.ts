/**
 * Workflow Rule Storage (Phase 2)
 *
 * CRUD operations for workflow_rules table.
 * Stores hooks, gates, and custom steps per project.
 */

import { customWorkflowStorage } from './custom-workflow-storage'
import { prjctDb } from './database'

export interface WorkflowRule {
  id: number
  type: 'hook' | 'gate' | 'step' | 'instruction'
  command: string
  position: string
  action: string
  description: string | null
  enabled: boolean
  timeoutMs: number
  createdAt: string
  sortOrder: number
}

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
}

function rowToRule(row: WorkflowRuleRow): WorkflowRule {
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
  }
}

class WorkflowRuleStorage {
  addRule(projectId: string, rule: Omit<WorkflowRule, 'id'>): number {
    const maxOrder = prjctDb.get<{ m: number | null }>(
      projectId,
      'SELECT MAX(sort_order) as m FROM workflow_rules WHERE command = ?',
      rule.command
    )
    const sortOrder = rule.sortOrder || (maxOrder?.m ?? -1) + 1

    prjctDb.run(
      projectId,
      `INSERT INTO workflow_rules (type, command, position, action, description, enabled, timeout_ms, created_at, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      rule.type,
      rule.command,
      rule.position,
      rule.action,
      rule.description ?? null,
      rule.enabled ? 1 : 0,
      rule.timeoutMs,
      rule.createdAt,
      sortOrder
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

    const fieldMap: Record<string, { column: string; transform?: (v: any) => any }> = {
      type: { column: 'type' },
      command: { column: 'command' },
      position: { column: 'position' },
      action: { column: 'action' },
      description: { column: 'description' },
      enabled: { column: 'enabled', transform: (v: boolean) => (v ? 1 : 0) },
      timeoutMs: { column: 'timeout_ms' },
      createdAt: { column: 'created_at' },
      sortOrder: { column: 'sort_order' },
    }

    const setClauses: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      const mapping = fieldMap[key]
      if (!mapping) continue
      setClauses.push(`${mapping.column} = ?`)
      values.push(mapping.transform ? mapping.transform(value) : value)
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
