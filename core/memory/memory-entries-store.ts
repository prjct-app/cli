/**
 * Schema v2 — Domain 1 write side (C1). Mirrors authored memory into the
 * normalized `memory_entries` + `memory_entry_tags` tables so recall can later
 * read typed rows + indexed tags instead of JSON.parse-ing `events.data` /
 * `memories.tags` on the per-prompt hot path.
 *
 * This is the DUAL-WRITE step: `remember()` keeps writing the events row and
 * the `memories` mirror, and ALSO calls this. The read flip + retirement of the
 * blob paths happen in a later step once parity holds. Best-effort by design —
 * a v2 write failure must never block a capture.
 */

import prjctDb from '../storage/database'
import { MACHINE_TAG_KEYS } from './format'

export interface MemoryEntryV2 {
  id: string
  projectId: string
  type: string
  content: string
  tags: Record<string, string>
  provenance: string
  contentHash: string
  /** epoch-ms; defaults to now-ish from the caller. */
  createdAt: number
  userTriggered?: boolean
}

function firstLineTitle(content: string): string {
  return (content.split('\n')[0] ?? content).slice(0, 80)
}

/**
 * Upsert one entry into the v2 tables. Idempotent on `id` (INSERT OR IGNORE);
 * tags are replaced so an updated tag set stays consistent. Derives the hot
 * `file` column (powers `prjct guard`) and the `is_machine` tag flag.
 */
export function upsertMemoryEntryV2(entry: MemoryEntryV2): void {
  try {
    const title = firstLineTitle(entry.content)
    const file = entry.tags.file ?? null
    const subject = entry.tags.subject ?? null
    prjctDb.run(
      entry.projectId,
      `INSERT OR IGNORE INTO memory_entries
         (id, project_id, type, title, content, file, subject, provenance,
          content_hash, user_triggered, revision_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      entry.id,
      entry.projectId,
      entry.type,
      title,
      entry.content,
      file,
      subject,
      entry.provenance,
      entry.contentHash,
      entry.userTriggered ? 1 : 0,
      entry.createdAt,
      entry.createdAt
    )
    // Replace tags so re-writes stay consistent (cheap; entries have few tags).
    prjctDb.run(entry.projectId, 'DELETE FROM memory_entry_tags WHERE entry_id = ?', entry.id)
    for (const [key, value] of Object.entries(entry.tags)) {
      if (value == null) continue
      prjctDb.run(
        entry.projectId,
        `INSERT OR IGNORE INTO memory_entry_tags (entry_id, key, value, is_machine)
         VALUES (?, ?, ?, ?)`,
        entry.id,
        key,
        String(value),
        MACHINE_TAG_KEYS.has(key) ? 1 : 0
      )
    }
  } catch {
    // Non-critical during dual-write — the events row + memories mirror remain
    // the source of truth until the read path is cut over.
  }
}
