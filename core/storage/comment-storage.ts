/**
 * Comment Storage
 *
 * Manages comments on queue tasks via direct SQLite (normalized table).
 * Follows the same pattern as workflow-rule-storage.ts.
 */

import type { TaskComment } from '../types/storage'
import { prjctDb } from './database'

interface CommentRow {
  id: string
  task_id: string
  author: string
  content: string
  created_at: string
  updated_at: string
}

function rowToComment(row: CommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    author: row.author,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function generateId(): string {
  return `cmt_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

class CommentStorage {
  addComment(
    projectId: string,
    taskId: string,
    content: string,
    author: string = 'user'
  ): TaskComment {
    const id = generateId()
    const now = new Date().toISOString()

    prjctDb.run(
      projectId,
      `INSERT INTO queue_task_comments (id, task_id, author, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      taskId,
      author,
      content,
      now,
      now
    )

    return { id, taskId, author, content, createdAt: now, updatedAt: now }
  }

  getComments(projectId: string, taskId: string): TaskComment[] {
    const rows = prjctDb.query<CommentRow>(
      projectId,
      'SELECT * FROM queue_task_comments WHERE task_id = ? ORDER BY created_at ASC',
      taskId
    )
    return rows.map(rowToComment)
  }

  updateComment(projectId: string, commentId: string, content: string): boolean {
    const existing = prjctDb.get<CommentRow>(
      projectId,
      'SELECT id FROM queue_task_comments WHERE id = ?',
      commentId
    )
    if (!existing) return false

    prjctDb.run(
      projectId,
      'UPDATE queue_task_comments SET content = ?, updated_at = ? WHERE id = ?',
      content,
      new Date().toISOString(),
      commentId
    )
    return true
  }

  deleteComment(projectId: string, commentId: string): boolean {
    const existing = prjctDb.get<CommentRow>(
      projectId,
      'SELECT id FROM queue_task_comments WHERE id = ?',
      commentId
    )
    if (!existing) return false

    prjctDb.run(projectId, 'DELETE FROM queue_task_comments WHERE id = ?', commentId)
    return true
  }
}

export const commentStorage = new CommentStorage()
