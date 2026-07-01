/**
 * Memories entity handler — applies a pulled `memories` event to local
 * storage. This is the highest-value cross-device entity (decisions,
 * learnings, gotchas, facts) and the one the old wire silently dropped.
 *
 * CRITICAL (mem_1683): a memory is a row in the **events** table
 * (`type = 'memory.remember.<type>'`); the `memories` table is only the
 * FTS mirror. We replicate `project-memory.remember()`'s internal writes —
 * events row + FTS mirror — but DELIBERATELY skip its `publishCRUD` call:
 * applying a pulled event must never re-enqueue it to `sync_pending`, or two
 * machines would echo the same memory back and forth forever.
 *
 * Identity across machines is `(content_hash, type)` — the local row id
 * (`mem_<eventId>`) differs per machine, so we dedupe and tombstone by the
 * content fingerprint, which is stable everywhere.
 */

import { memoryFingerprint } from '../../memory/content-fingerprint'
import { REMEMBER_ACTION_PREFIX } from '../../memory/events'
import prjctDb from '../../storage/database'
import type { ApplyData, EntityHandler } from './types'

/** Tags arrive as an object (round-tripped JSON) or, defensively, a string. */
function asTags(value: unknown): Record<string, string> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, string>
    } catch {
      return {}
    }
  }
  if (typeof value === 'object') return value as Record<string, string>
  return {}
}

function field(data: ApplyData, snake: string, camel: string): string {
  return (data[snake] as string) ?? (data[camel] as string) ?? ''
}

export const memoriesHandler: EntityHandler = {
  async upsert(projectId, data) {
    const content = field(data, 'content', 'content')
    const type = field(data, 'type', 'type')
    if (!content || !type) return

    const tags = asTags(data.tags)
    const provenance = field(data, 'provenance', 'provenance') || 'declared'
    const source = (data.source as string) ?? null
    const contentHash = memoryFingerprint(content)

    // Cross-device identity + idempotency: the same (content_hash, type)
    // already present is the same knowledge — skip (also makes re-pull a no-op).
    const dup = prjctDb.get<{ id: string }>(
      projectId,
      'SELECT id FROM memory_entries WHERE content_hash = ? AND type = ? AND deleted_at IS NULL LIMIT 1',
      contentHash,
      type
    )
    if (dup) return

    // Preserve the authored time from the remote event so chronology survives
    // the round trip (machine A's 10:00 memory shows as 10:00 on machine B,
    // not "now"). Falls back to now only when the event omits it.
    const authored =
      (data.created_at as string) || (data.createdAt as string) || new Date().toISOString()

    // Source of truth: the events row. NO publishCRUD here (no echo). Carry the
    // real content_hash, project_id, and the AUTHORED created_at so the
    // memory_entries trigger writes correct dedup + cross-device chronology
    // (appendEvent stamps events.timestamp = local apply time).
    prjctDb.appendEvent(projectId, `memory.${REMEMBER_ACTION_PREFIX}${type}`, {
      content,
      tags,
      source,
      provenance,
      content_hash: contentHash,
      project_id: projectId,
      created_at: authored,
    })
    // memory_entries (single source for recall + FTS) is populated by the
    // memory_entries_from_events trigger on the appendEvent above — with the
    // real content_hash, project_id, and authored created_at carried in the
    // payload. No `memories` mirror anymore.
  },

  async delete(projectId, data) {
    const id = field(data, 'id', 'id')
    const content = field(data, 'content', 'content')
    const type = field(data, 'type', 'type')

    const candidates: string[] = []
    if (/^mem_\d+$/.test(id)) candidates.push(id)
    if (content && type) {
      const contentHash = memoryFingerprint(content)
      const rows = prjctDb.query<{ id: string }>(
        projectId,
        'SELECT id FROM memory_entries WHERE content_hash = ? AND type = ? AND deleted_at IS NULL',
        contentHash,
        type
      )
      candidates.push(...rows.map((row) => row.id))
    }

    const unique = [...new Set(candidates)]
    for (const memId of unique) {
      const numeric = memId.match(/^mem_(\d+)$/)?.[1]
      if (numeric) {
        prjctDb.run(
          projectId,
          'UPDATE events SET type = ? WHERE id = ?',
          'memory.deleted.context-quality',
          Number(numeric)
        )
      }
      // Single source: soft-delete in memory_entries (recall + FTS) + drop embedding.
      prjctDb.run(
        projectId,
        'UPDATE memory_entries SET deleted_at = ? WHERE id = ?',
        Date.now(),
        memId
      )
      prjctDb.run(projectId, 'DELETE FROM memory_embeddings WHERE memory_id = ?', memId)
    }
  },
}
