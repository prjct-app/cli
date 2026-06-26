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
      'SELECT id FROM memories WHERE content_hash = ? AND type = ? AND deleted_at IS NULL LIMIT 1',
      contentHash,
      type
    )
    if (dup) return

    // Source of truth: the events row. NO publishCRUD here (no echo).
    const eventId = prjctDb.appendEvent(projectId, `memory.${REMEMBER_ACTION_PREFIX}${type}`, {
      content,
      tags,
      source,
      provenance,
    })
    if (eventId == null) return

    // FTS mirror — same INSERT shape as project-memory.remember().
    const memId = `mem_${eventId}`
    // Preserve the authored time from the remote event so chronology survives
    // the round trip (machine A's 10:00 memory shows as 10:00 on machine B,
    // not "now"). Falls back to now only when the event omits it.
    const authored =
      (data.created_at as string) || (data.createdAt as string) || new Date().toISOString()
    const now = new Date().toISOString()
    const title = (content.split('\n')[0] ?? content).slice(0, 80)
    try {
      prjctDb.run(
        projectId,
        `INSERT OR IGNORE INTO memories
           (id, project_id, title, content, tags, type, provenance, content_hash,
            user_triggered, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        memId,
        projectId,
        title,
        content,
        JSON.stringify(tags),
        type,
        provenance,
        contentHash,
        0,
        authored,
        now
      )
    } catch {
      // Non-critical — the events row is authoritative.
    }
  },

  async delete(_projectId, _data) {
    // No-op by design: sync NEVER deletes or modifies a local record. A memory
    // removed on another machine stays in this machine's vault — local is the
    // source of truth and is never destroyed by a pull.
  },
}
