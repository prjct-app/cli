/**
 * Spec Storage — SQLite-direct CRUD for the `specs` table (migration 16).
 *
 * Same shape as `custom-workflow-storage.ts`: thin domain methods over
 * `prjctDb.run/query/get`, no abstraction layer. Service layer
 * (`spec-service`) handles validation + side effects (vault render).
 */

import { generateUUID } from '../schemas/schemas'
import {
  SPEC_STATUSES,
  type Spec,
  type SpecContent,
  SpecContentSchema,
  type SpecStatus,
} from '../types/spec'
import { getTimestamp } from '../utils/date-helper'
import prjctDb from './database'
import type { SqliteBindings } from './database/sqlite-compat'

interface SpecRow {
  id: string
  title: string
  status: string
  content: string
  tags: string | null
  created_at: string
  updated_at: string
  shipped_at: string | null
  shipped_pr: number | null
  archived_at: string | null
}

class SpecStorage {
  /**
   * Create a new spec. Returns the spec id.
   */
  create(
    projectId: string,
    args: {
      title: string
      content: SpecContent
      tags?: Record<string, string>
    }
  ): Spec {
    const id = generateUUID()
    const now = getTimestamp()
    const validatedContent = SpecContentSchema.parse(args.content)

    prjctDb.run(
      projectId,
      `INSERT INTO specs (id, title, status, content, tags, created_at, updated_at)
       VALUES (?, ?, 'draft', ?, ?, ?, ?)`,
      id,
      args.title,
      JSON.stringify(validatedContent),
      args.tags ? JSON.stringify(args.tags) : null,
      now,
      now
    )

    return {
      id,
      title: args.title,
      status: 'draft',
      content: validatedContent,
      tags: args.tags ?? {},
      createdAt: now,
      updatedAt: now,
      shippedAt: null,
      shippedPr: null,
      archivedAt: null,
    }
  }

  get(projectId: string, id: string): Spec | null {
    const row = prjctDb.get<SpecRow>(projectId, 'SELECT * FROM specs WHERE id = ?', id)
    return row ? this.rowToSpec(row) : null
  }

  list(projectId: string, filter: { status?: SpecStatus; includeArchived?: boolean } = {}): Spec[] {
    let sql = 'SELECT * FROM specs WHERE 1=1'
    const params: SqliteBindings[] = []
    if (filter.status) {
      sql += ' AND status = ?'
      params.push(filter.status)
    }
    if (!filter.includeArchived && !filter.status) {
      sql += " AND status != 'archived'"
    }
    sql += ' ORDER BY created_at DESC'
    const rows = prjctDb.query<SpecRow>(projectId, sql, ...params)
    return rows.map((r) => this.rowToSpec(r))
  }

  /**
   * Fuzzy-match title or content. Falls back to LIKE — for serious
   * search the FTS5 `memories_fts` table is the better surface.
   */
  search(projectId: string, query: string): Spec[] {
    const like = `%${query}%`
    const rows = prjctDb.query<SpecRow>(
      projectId,
      `SELECT * FROM specs WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC`,
      like,
      like
    )
    return rows.map((r) => this.rowToSpec(r))
  }

  updateContent(projectId: string, id: string, content: SpecContent): Spec | null {
    const validated = SpecContentSchema.parse(content)
    const now = getTimestamp()
    prjctDb.run(
      projectId,
      'UPDATE specs SET content = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(validated),
      now,
      id
    )
    return this.get(projectId, id)
  }

  setStatus(projectId: string, id: string, status: SpecStatus): Spec | null {
    if (!SPEC_STATUSES.includes(status)) {
      throw new Error(`invalid spec status: ${status}`)
    }
    const now = getTimestamp()
    const extras: string[] = []
    const params: SqliteBindings[] = [status, now]
    if (status === 'shipped') {
      extras.push('shipped_at = ?')
      params.push(now)
    }
    if (status === 'archived') {
      extras.push('archived_at = ?')
      params.push(now)
    }
    const setClause = ['status = ?', 'updated_at = ?', ...extras].join(', ')
    params.push(id)
    prjctDb.run(projectId, `UPDATE specs SET ${setClause} WHERE id = ?`, ...params)
    return this.get(projectId, id)
  }

  setShippedPr(projectId: string, id: string, pr: number): Spec | null {
    prjctDb.run(
      projectId,
      'UPDATE specs SET shipped_pr = ?, updated_at = ? WHERE id = ?',
      pr,
      getTimestamp(),
      id
    )
    return this.get(projectId, id)
  }

  /**
   * Append a task id to the spec's `linked_tasks`. Idempotent.
   */
  linkTask(projectId: string, specId: string, taskId: string): Spec | null {
    const spec = this.get(projectId, specId)
    if (!spec) return null
    if (spec.content.linked_tasks.includes(taskId)) return spec
    const next: SpecContent = {
      ...spec.content,
      linked_tasks: [...spec.content.linked_tasks, taskId],
    }
    return this.updateContent(projectId, specId, next)
  }

  delete(projectId: string, id: string): boolean {
    const before = this.get(projectId, id)
    if (!before) return false
    prjctDb.run(projectId, 'DELETE FROM specs WHERE id = ?', id)
    return true
  }

  count(projectId: string): { total: number; draft: number; shipped: number } {
    const rows = prjctDb.query<{ status: string; n: number }>(
      projectId,
      'SELECT status, COUNT(*) AS n FROM specs GROUP BY status'
    )
    const out = { total: 0, draft: 0, shipped: 0 }
    for (const r of rows) {
      out.total += r.n
      if (r.status === 'draft') out.draft = r.n
      if (r.status === 'shipped') out.shipped = r.n
    }
    return out
  }

  private rowToSpec(row: SpecRow): Spec {
    return {
      id: row.id,
      title: row.title,
      status: (SPEC_STATUSES as readonly string[]).includes(row.status)
        ? (row.status as SpecStatus)
        : 'draft',
      content: SpecContentSchema.parse(JSON.parse(row.content)),
      tags: row.tags ? (JSON.parse(row.tags) as Record<string, string>) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      shippedAt: row.shipped_at,
      shippedPr: row.shipped_pr,
      archivedAt: row.archived_at,
    }
  }
}

export const specStorage = new SpecStorage()
export type { SpecStorage }
