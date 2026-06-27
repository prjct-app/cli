/**
 * Archives entity handler — applies a pulled `archives` event to local
 * storage so archived records (stale shipped/ideas/queue/memories moved
 * out of active storage) round-trip across machines.
 *
 * Cross-machine identity is the ARCHIVED pair `(entity_type, entity_id)`,
 * not the archive row's own `id` (generated per machine, so it differs
 * everywhere). An entity is archived once — if this machine already has
 * an archive for that pair, applying again is a no-op.
 *
 * Apply is ADDITIVE and writes WITHOUT re-publishing (no echo): the
 * `archives` table has no sync producer on insert here, mirroring how the
 * other pulled handlers avoid re-enqueuing.
 *
 * `entity_data` arrives as the JSON-encoded archived row (same shape the
 * local column stores), so a receiver reconstructs the full record rather
 * than a lossy id-only stub. `delete` is a NO-OP — sync never removes a
 * local archive.
 */

import prjctDb from '../../storage/database'
import type { ApplyData, EntityHandler } from './types'

function str(data: ApplyData, snake: string, camel: string): string {
  return (data[snake] as string) ?? (data[camel] as string) ?? ''
}

export const archivesHandler: EntityHandler = {
  async upsert(projectId, data) {
    const id = str(data, 'id', 'id')
    const entityType = str(data, 'entity_type', 'entityType')
    const entityId = str(data, 'entity_id', 'entityId')
    if (!id || !entityType || !entityId) return

    // An entity is archived once — dedupe by the archived pair so a
    // re-pull (or a different per-machine archive id) doesn't duplicate.
    const dup = prjctDb.get<{ id: string }>(
      projectId,
      'SELECT id FROM archives WHERE entity_type = ? AND entity_id = ? LIMIT 1',
      entityType,
      entityId
    )
    if (dup) return

    // entity_data rides as a JSON string (matches the local column). Fall
    // back to '{}' rather than NULL — the column is NOT NULL.
    const entityData =
      typeof data.entity_data === 'string'
        ? data.entity_data
        : data.entity_data != null
          ? JSON.stringify(data.entity_data)
          : '{}'
    // Origin time: prefer the explicit created_at, else archived_at.
    const archivedAt =
      str(data, 'archived_at', 'archivedAt') ||
      str(data, 'created_at', 'createdAt') ||
      new Date().toISOString()
    const summary = (data.summary as string) ?? null
    const reason = str(data, 'reason', 'reason') || 'sync'

    try {
      prjctDb.run(
        projectId,
        `INSERT OR IGNORE INTO archives
           (id, entity_type, entity_id, entity_data, summary, archived_at, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id,
        entityType,
        entityId,
        entityData,
        summary,
        archivedAt,
        reason
      )
    } catch {
      // Best-effort — a malformed archive row must not break the batch.
    }
  },

  async delete(_projectId, _data) {
    // No-op by design: sync never removes a local archive.
  },
}
