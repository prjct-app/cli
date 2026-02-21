/**
 * Custom Workflow Storage
 *
 * CRUD operations for user-defined workflows with agentic auto-configuration.
 * Built-in workflows (task, done, ship, sync) are immutable and cannot be deleted.
 */

import type { CustomWorkflow } from '../types/storage.js'
import prjctDb from './database'

interface CustomWorkflowRow {
  id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
  is_builtin: number
  enabled: number
  metadata: string | null
}

class CustomWorkflowStorage {
  /**
   * Create a new custom workflow.
   * Returns the workflow ID.
   */
  createWorkflow(
    projectId: string,
    workflow: {
      name: string
      description?: string
      metadata?: Record<string, unknown>
    }
  ): number {
    const now = new Date().toISOString()

    prjctDb.run(
      projectId,
      `INSERT INTO custom_workflows (name, description, created_at, updated_at, is_builtin, enabled, metadata)
       VALUES (?, ?, ?, ?, 0, 1, ?)`,
      workflow.name,
      workflow.description ?? null,
      now,
      now,
      workflow.metadata ? JSON.stringify(workflow.metadata) : null
    )

    // Get the inserted ID
    const result = prjctDb.get<{ id: number }>(
      projectId,
      'SELECT id FROM custom_workflows WHERE name = ?',
      workflow.name
    )

    if (!result) {
      throw new Error(`Failed to create workflow: ${workflow.name}`)
    }

    return result.id
  }

  /**
   * Get a workflow by name.
   * Returns null if not found.
   */
  getWorkflow(projectId: string, name: string): CustomWorkflow | null {
    const row = prjctDb.get<CustomWorkflowRow>(
      projectId,
      'SELECT * FROM custom_workflows WHERE name = ?',
      name
    )

    if (!row) return null

    return this.rowToWorkflow(row)
  }

  /**
   * Get all workflows (built-in + custom).
   * By default, excludes disabled workflows.
   */
  getAllWorkflows(projectId: string, includeDisabled = false): CustomWorkflow[] {
    const sql = includeDisabled
      ? 'SELECT * FROM custom_workflows ORDER BY is_builtin DESC, name ASC'
      : 'SELECT * FROM custom_workflows WHERE enabled = 1 ORDER BY is_builtin DESC, name ASC'

    const rows = prjctDb.query<CustomWorkflowRow>(projectId, sql)
    return rows.map((row) => this.rowToWorkflow(row))
  }

  /**
   * Update a workflow.
   * Cannot modify built-in workflows' name or is_builtin flag.
   */
  updateWorkflow(
    projectId: string,
    name: string,
    updates: {
      description?: string
      enabled?: boolean
      metadata?: Record<string, unknown>
    }
  ): boolean {
    const workflow = this.getWorkflow(projectId, name)
    if (!workflow) return false

    const now = new Date().toISOString()
    const fields: string[] = []
    const values: (string | number | null)[] = []

    if (updates.description !== undefined) {
      fields.push('description = ?')
      values.push(updates.description)
    }

    if (updates.enabled !== undefined) {
      fields.push('enabled = ?')
      values.push(updates.enabled ? 1 : 0)
    }

    if (updates.metadata !== undefined) {
      fields.push('metadata = ?')
      values.push(JSON.stringify(updates.metadata))
    }

    if (fields.length === 0) return false

    fields.push('updated_at = ?')
    values.push(now)
    values.push(name)

    prjctDb.run(
      projectId,
      `UPDATE custom_workflows SET ${fields.join(', ')} WHERE name = ?`,
      ...values
    )

    return true
  }

  /**
   * Delete a custom workflow (soft delete via enabled flag).
   * Rejects if workflow is built-in.
   */
  deleteWorkflow(projectId: string, name: string): boolean {
    const workflow = this.getWorkflow(projectId, name)
    if (!workflow) return false

    if (workflow.isBuiltin) {
      throw new Error(`Cannot delete built-in workflow: ${name}`)
    }

    // Soft delete: set enabled = 0
    prjctDb.run(projectId, 'UPDATE custom_workflows SET enabled = 0 WHERE name = ?', name)

    return true
  }

  /**
   * Check if a workflow is built-in.
   */
  isBuiltin(projectId: string, name: string): boolean {
    const workflow = this.getWorkflow(projectId, name)
    return workflow?.isBuiltin ?? false
  }

  /**
   * Check if a workflow name is reserved (built-in or command verb).
   */
  isReservedName(name: string): boolean {
    const builtinWorkflows = ['task', 'done', 'ship', 'sync']
    const commandVerbs = [
      'add',
      'rm',
      'gate',
      'list',
      'create',
      'delete',
      'run',
      'help',
      'reset',
      'init',
    ]

    return builtinWorkflows.includes(name) || commandVerbs.includes(name)
  }

  /**
   * Validate workflow name (lowercase alphanumeric + hyphens).
   */
  isValidName(name: string): boolean {
    return /^[a-z0-9-]+$/.test(name)
  }

  /**
   * Convert database row to CustomWorkflow object.
   */
  private rowToWorkflow(row: CustomWorkflowRow): CustomWorkflow {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isBuiltin: row.is_builtin === 1,
      enabled: row.enabled === 1,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }
  }
}

// Singleton export
export const customWorkflowStorage = new CustomWorkflowStorage()
export default customWorkflowStorage
