/**
 * sync_applied_hashes — local idempotency probe for inbound SyncEvents.
 *
 * Phase 1.6 / B2: when applyEvent receives an event with a content_hash,
 * we record (entity_type, entity_id) → content_hash so a re-applied
 * event with the same hash can short-circuit the handler upsert.
 * Side table by design — see migration 19 for rationale.
 *
 * Two operations only: getApplied (probe) and recordApplied (UPSERT).
 * Stays out of the entity-handlers concern of WHAT to write — they own
 * their storage, this owns the hash trail.
 */

import prjctDb from '../storage/database'
import { getTimestamp } from '../utils/date-helper'

interface AppliedHashRow {
  content_hash: string
  applied_at: string
}

/**
 * Look up the last-applied content_hash for an entity. Returns null
 * when no event has been applied yet. Best-effort — DB errors return
 * null so apply proceeds rather than blocking.
 */
export function getApplied(projectId: string, entityType: string, entityId: string): string | null {
  if (!entityType || !entityId) return null
  try {
    const row = prjctDb.get<AppliedHashRow>(
      projectId,
      'SELECT content_hash, applied_at FROM sync_applied_hashes WHERE entity_type = ? AND entity_id = ?',
      entityType,
      entityId
    )
    return row?.content_hash ?? null
  } catch {
    return null
  }
}

/**
 * UPSERT the content_hash for an entity. Called by applyEvent AFTER the
 * handler succeeds — handler durability is the source of truth, this
 * just records what we last applied so the next event can dedupe.
 *
 * Not run inside the handler's transaction: handler storage may span
 * multiple tables and a sync_applied_hashes write failure here costs
 * at most one redundant handler invocation on the next event (handlers
 * are id-idempotent already), which is cheaper than the cross-cutting
 * complexity of a shared transaction.
 */
export function recordApplied(
  projectId: string,
  entityType: string,
  entityId: string,
  contentHash: string
): void {
  if (!entityType || !entityId || !contentHash) return
  try {
    prjctDb.run(
      projectId,
      `INSERT INTO sync_applied_hashes (entity_type, entity_id, content_hash, applied_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(entity_type, entity_id) DO UPDATE SET
         content_hash = excluded.content_hash,
         applied_at   = excluded.applied_at`,
      entityType,
      entityId,
      contentHash,
      getTimestamp()
    )
  } catch {
    // Best-effort — see header. Caller is applyEvent which already
    // committed the handler's write.
  }
}

/**
 * Drop the hash trail for an entity. Called by applyEvent after a
 * tombstone (delete) so a future re-create with the same payload
 * (same content_hash) doesn't get incorrectly deduped as "already
 * applied". Without this, deleted-then-recreated entities silently
 * fail to re-apply.
 */
export function clearApplied(projectId: string, entityType: string, entityId: string): void {
  if (!entityType || !entityId) return
  try {
    prjctDb.run(
      projectId,
      'DELETE FROM sync_applied_hashes WHERE entity_type = ? AND entity_id = ?',
      entityType,
      entityId
    )
  } catch {
    // Best-effort.
  }
}
