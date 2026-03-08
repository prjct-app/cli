/**
 * Semantic Memories - FTS5-backed searchable memory store
 *
 * SQLite FTS5 replaces in-memory `.includes()` search.
 * BM25 ranking, SHA-256 dedup, topic_key upsert, soft-delete.
 *
 * @module agentic/semantic-memories
 */

import { generateUUID } from '../schemas/schemas'
import prjctDb from '../storage/database'
import type {
  Memory,
  MemoryContext,
  MemoryRetrievalResult,
  MemoryTag,
  RelevantMemoryQuery,
} from '../types/memory'
import { MEMORY_TAGS } from '../types/memory'
import { getTimestamp } from '../utils/date-helper'
import { sha256Short } from '../utils/hash'

// =============================================================================
// Row type from SQLite
// =============================================================================

interface MemoryRow {
  id: string
  project_id: string
  title: string
  content: string
  tags: string | null
  topic_key: string | null
  content_hash: string | null
  user_triggered: number
  revision_count: number
  confidence: string | null
  observation_count: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function rowToMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags ? (row.tags.split(',').filter(Boolean) as MemoryTag[]) : [],
    userTriggered: row.user_triggered === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confidence: row.confidence as Memory['confidence'],
    observationCount: row.observation_count || undefined,
  }
}

// =============================================================================
// Semantic Memories (FTS5)
// =============================================================================

export class SemanticMemories {
  private _coerceTags(tags: string[]): MemoryTag[] {
    const allowed = new Set<MemoryTag>(Object.values(MEMORY_TAGS) as MemoryTag[])
    return tags.filter((t): t is MemoryTag => allowed.has(t as MemoryTag))
  }

  /**
   * Create a memory. Deduplicates by content_hash and upserts by topic_key.
   */
  async createMemory(
    projectId: string,
    {
      title,
      content,
      tags = [],
      userTriggered = false,
      topicKey,
    }: {
      title: string
      content: string
      tags?: string[]
      userTriggered?: boolean
      topicKey?: string
    }
  ): Promise<string> {
    const parsedTags = this._coerceTags(tags)
    const tagsStr = parsedTags.join(',')
    const now = getTimestamp()
    const contentHash = sha256Short(content)

    // Dedup: if same content_hash exists for this project, skip
    const existing = prjctDb.get<{ id: string }>(
      projectId,
      'SELECT id FROM memories WHERE project_id = ? AND content_hash = ? AND deleted_at IS NULL',
      projectId,
      contentHash
    )
    if (existing) return existing.id

    // Topic key upsert: if same topic_key exists, update instead
    if (topicKey) {
      const topicRow = prjctDb.get<MemoryRow>(
        projectId,
        'SELECT * FROM memories WHERE project_id = ? AND topic_key = ? AND deleted_at IS NULL',
        projectId,
        topicKey
      )
      if (topicRow) {
        prjctDb.run(
          projectId,
          `UPDATE memories SET title = ?, content = ?, tags = ?, content_hash = ?,
           revision_count = revision_count + 1, updated_at = ? WHERE id = ?`,
          title,
          content,
          tagsStr,
          contentHash,
          now,
          topicRow.id
        )
        return topicRow.id
      }
    }

    const id = generateUUID()
    prjctDb.run(
      projectId,
      `INSERT INTO memories
        (id, project_id, title, content, tags, topic_key, content_hash, user_triggered, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      projectId,
      title,
      content,
      tagsStr,
      topicKey ?? null,
      contentHash,
      userTriggered ? 1 : 0,
      now,
      now
    )
    return id
  }

  async updateMemory(
    projectId: string,
    memoryId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ): Promise<boolean> {
    const existing = prjctDb.get<MemoryRow>(
      projectId,
      'SELECT * FROM memories WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
      memoryId,
      projectId
    )
    if (!existing) return false

    const title = updates.title ?? existing.title
    const content = updates.content ?? existing.content
    const tags = updates.tags ? this._coerceTags(updates.tags).join(',') : existing.tags
    const contentHash = updates.content ? sha256Short(content) : existing.content_hash

    prjctDb.run(
      projectId,
      `UPDATE memories SET title = ?, content = ?, tags = ?, content_hash = ?,
       revision_count = revision_count + 1, updated_at = ? WHERE id = ?`,
      title,
      content,
      tags,
      contentHash,
      getTimestamp(),
      memoryId
    )
    return true
  }

  /**
   * Soft-delete a memory (sets deleted_at).
   */
  async deleteMemory(projectId: string, memoryId: string): Promise<boolean> {
    const existing = prjctDb.get<{ id: string }>(
      projectId,
      'SELECT id FROM memories WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
      memoryId,
      projectId
    )
    if (!existing) return false

    prjctDb.run(
      projectId,
      'UPDATE memories SET deleted_at = ? WHERE id = ?',
      getTimestamp(),
      memoryId
    )
    return true
  }

  async findByTags(
    projectId: string,
    tags: string[],
    matchAll: boolean = false
  ): Promise<Memory[]> {
    const rows = prjctDb.query<MemoryRow>(
      projectId,
      'SELECT * FROM memories WHERE project_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
      projectId
    )

    const parsedTags = this._coerceTags(tags)
    const filtered = rows.filter((row) => {
      const rowTags = row.tags ? row.tags.split(',') : []
      if (matchAll) {
        return parsedTags.every((tag) => rowTags.includes(tag))
      }
      return parsedTags.some((tag) => rowTags.includes(tag))
    })

    return filtered.map(rowToMemory)
  }

  /**
   * FTS5 full-text search with BM25 ranking.
   * Falls back to LIKE if FTS query syntax is invalid.
   */
  async searchMemories(projectId: string, query: string): Promise<Memory[]> {
    try {
      const rows = prjctDb.query<MemoryRow>(
        projectId,
        `SELECT m.* FROM memories m
         JOIN memories_fts fts ON m.rowid = fts.rowid
         WHERE memories_fts MATCH ? AND m.project_id = ? AND m.deleted_at IS NULL
         ORDER BY bm25(memories_fts) LIMIT 20`,
        query,
        projectId
      )
      return rows.map(rowToMemory)
    } catch {
      // FTS query syntax error — fall back to LIKE
      const safeQuery = `%${query}%`
      const rows = prjctDb.query<MemoryRow>(
        projectId,
        `SELECT * FROM memories
         WHERE project_id = ? AND deleted_at IS NULL
         AND (title LIKE ? OR content LIKE ?)
         ORDER BY updated_at DESC LIMIT 20`,
        projectId,
        safeQuery,
        safeQuery
      )
      return rows.map(rowToMemory)
    }
  }

  /**
   * Get memories relevant to the current context using FTS5 + scoring.
   */
  async getRelevantMemories(
    projectId: string,
    context: MemoryContext,
    limit: number = 5
  ): Promise<Memory[]> {
    // Build a query string from context
    const parts: string[] = []
    if (context.commandName) parts.push(context.commandName)
    if (context.params?.description) parts.push(String(context.params.description))
    if (context.params?.task) parts.push(String(context.params.task))
    if (context.params?.feature) parts.push(String(context.params.feature))

    if (parts.length === 0) {
      // No context — return most recent
      const rows = prjctDb.query<MemoryRow>(
        projectId,
        'SELECT * FROM memories WHERE project_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?',
        projectId,
        limit
      )
      return rows.map(rowToMemory)
    }

    // Use FTS5 search with combined keywords
    const query = parts.join(' ')
    try {
      const rows = prjctDb.query<MemoryRow>(
        projectId,
        `SELECT m.* FROM memories m
         JOIN memories_fts fts ON m.rowid = fts.rowid
         WHERE memories_fts MATCH ? AND m.project_id = ? AND m.deleted_at IS NULL
         ORDER BY bm25(memories_fts) LIMIT ?`,
        query,
        projectId,
        limit
      )
      return rows.map(rowToMemory)
    } catch {
      // FTS query syntax error — fall back to recent
      const rows = prjctDb.query<MemoryRow>(
        projectId,
        'SELECT * FROM memories WHERE project_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?',
        projectId,
        limit
      )
      return rows.map(rowToMemory)
    }
  }

  /**
   * Enhanced memory retrieval with metrics.
   */
  async getRelevantMemoriesWithMetrics(
    projectId: string,
    query: RelevantMemoryQuery
  ): Promise<MemoryRetrievalResult> {
    const totalRow = prjctDb.get<{ count: number }>(
      projectId,
      'SELECT COUNT(*) as count FROM memories WHERE project_id = ? AND deleted_at IS NULL',
      projectId
    )
    const totalMemories = totalRow?.count ?? 0

    if (totalMemories === 0) {
      return {
        memories: [],
        metrics: {
          totalMemories: 0,
          memoriesConsidered: 0,
          memoriesReturned: 0,
          filteringRatio: 0,
          avgRelevanceScore: 0,
        },
      }
    }

    const maxResults = query.maxResults ?? 10

    // Use FTS5 if we have a task description
    const context: { commandName?: string; params?: Record<string, unknown> } = {}
    if (query.commandName) context.commandName = query.commandName
    if (query.taskDescription) context.params = { description: query.taskDescription }

    const memories = await this.getRelevantMemories(projectId, context, maxResults)

    // Assign simple relevance scores (FTS5 bm25 handles ranking)
    const scored = memories.map((m, i) => ({
      ...m,
      relevanceScore: Math.max(10, 100 - i * 10),
      scoreBreakdown: {
        domainMatch: 0,
        tagMatch: 0,
        recency: 0,
        confidence: 0,
        keywords: Math.max(10, 100 - i * 10),
        userTriggered: m.userTriggered ? 5 : 0,
      },
    }))

    const avgRelevanceScore =
      scored.length > 0
        ? Math.round(scored.reduce((sum, m) => sum + m.relevanceScore, 0) / scored.length)
        : 0

    return {
      memories: scored,
      metrics: {
        totalMemories,
        memoriesConsidered: totalMemories,
        memoriesReturned: scored.length,
        filteringRatio: totalMemories > 0 ? scored.length / totalMemories : 0,
        avgRelevanceScore,
      },
    }
  }

  /**
   * Auto-remember a decision (upserts by decision type as topic_key).
   */
  async autoRemember(
    projectId: string,
    decisionType: string,
    value: string,
    context: string = ''
  ): Promise<void> {
    const tagMap: Record<string, string[]> = {
      commit_footer: [MEMORY_TAGS.COMMIT_STYLE],
      branch_naming: [MEMORY_TAGS.BRANCH_NAMING],
      test_before_ship: [MEMORY_TAGS.TEST_BEHAVIOR, MEMORY_TAGS.SHIP_WORKFLOW],
      preferred_agent: [MEMORY_TAGS.AGENT_PREFERENCE],
      code_style: [MEMORY_TAGS.CODE_STYLE],
      verbosity: [MEMORY_TAGS.OUTPUT_VERBOSITY],
    }

    const tags = tagMap[decisionType] || []

    await this.createMemory(projectId, {
      title: `Preference: ${decisionType}`,
      content: `${decisionType}: ${value}${context ? `\nContext: ${context}` : ''}`,
      tags,
      userTriggered: true,
      topicKey: `preference:${decisionType}`,
    })
  }

  async getAllMemories(projectId: string): Promise<Memory[]> {
    const rows = prjctDb.query<MemoryRow>(
      projectId,
      'SELECT * FROM memories WHERE project_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
      projectId
    )
    return rows.map(rowToMemory)
  }

  async getMemoryStats(projectId: string) {
    const rows = prjctDb.query<MemoryRow>(
      projectId,
      'SELECT * FROM memories WHERE project_id = ? AND deleted_at IS NULL',
      projectId
    )

    const tagCounts: Record<string, number> = {}
    for (const row of rows) {
      const tags = row.tags ? row.tags.split(',').filter(Boolean) : []
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }
    }

    return {
      totalMemories: rows.length,
      userTriggered: rows.filter((r) => r.user_triggered === 1).length,
      tagCounts,
      oldestMemory: rows[rows.length - 1]?.created_at,
      newestMemory: rows[0]?.created_at,
    }
  }

  /**
   * Load memories (backward compat — returns MemoryDatabase shape).
   */
  async loadMemories(projectId: string) {
    const memories = await this.getAllMemories(projectId)
    return { version: 1, memories, index: {} }
  }

  /**
   * Save memories (no-op — SQLite is always persisted).
   */
  async saveMemories(_projectId: string): Promise<void> {
    // No-op: SQLite writes are immediate
  }

  /**
   * Reset (for testing).
   */
  reset(): void {
    // No in-memory cache to reset — SQLite is the source of truth
  }
}
