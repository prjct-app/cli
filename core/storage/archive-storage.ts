/**
 * Archive Storage (PRJ-267)
 *
 * Manages archival of stale data from active storage.
 * Works directly with the `archives` SQLite table (not kv_store).
 *
 * Archived data is accessible via explicit queries but never
 * loaded into LLM context files.
 */

import { generateUUID } from '../schemas/schemas'
import type {
  ArchiveEntityType,
  ArchiveItem,
  ArchiveRecord,
  ArchiveStats,
} from '../types/storage/extended'
import { getTimestamp } from '../utils/date-helper'
import { prjctDb } from './database'

// =============================================================================
// Archival Policy Constants
// =============================================================================

export const ARCHIVE_POLICIES = {
  SHIPPED_RETENTION_DAYS: 90,
  IDEA_DORMANT_DAYS: 180,
  QUEUE_COMPLETED_DAYS: 7,
  PAUSED_TASK_DAYS: 30,
  MEMORY_MAX_ENTRIES: 500,
} as const

// =============================================================================
// Archive Storage
// =============================================================================

class ArchiveStorage {
  /**
   * Archive a single item
   */
  archive(projectId: string, item: ArchiveItem): string {
    const id = generateUUID()
    const now = getTimestamp()

    prjctDb.run(
      projectId,
      'INSERT INTO archives (id, entity_type, entity_id, entity_data, summary, archived_at, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      item.entityType,
      item.entityId,
      JSON.stringify(item.entityData),
      item.summary ?? null,
      now,
      item.reason
    )

    return id
  }

  /**
   * Archive multiple items in a transaction
   */
  archiveMany(projectId: string, items: ArchiveItem[]): number {
    if (items.length === 0) return 0

    const now = getTimestamp()

    prjctDb.transaction(projectId, (db) => {
      const stmt = db.prepare(
        'INSERT INTO archives (id, entity_type, entity_id, entity_data, summary, archived_at, reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )

      for (const item of items) {
        stmt.run(
          generateUUID(),
          item.entityType,
          item.entityId,
          JSON.stringify(item.entityData),
          item.summary ?? null,
          now,
          item.reason
        )
      }
    })

    return items.length
  }

  /**
   * Query archived items by type
   */
  getArchived(projectId: string, entityType?: ArchiveEntityType, limit = 50): ArchiveRecord[] {
    if (entityType) {
      return prjctDb.query<ArchiveRecord>(
        projectId,
        'SELECT * FROM archives WHERE entity_type = ? ORDER BY archived_at DESC LIMIT ?',
        entityType,
        limit
      )
    }
    return prjctDb.query<ArchiveRecord>(
      projectId,
      'SELECT * FROM archives ORDER BY archived_at DESC LIMIT ?',
      limit
    )
  }

  /**
   * Get count of archived items by type
   */
  getStats(projectId: string): ArchiveStats {
    const rows = prjctDb.query<{ entity_type: string; count: number }>(
      projectId,
      'SELECT entity_type, COUNT(*) as count FROM archives GROUP BY entity_type'
    )

    const stats: ArchiveStats = {
      shipped: 0,
      idea: 0,
      queue_task: 0,
      paused_task: 0,
      memory_entry: 0,
      total: 0,
    }

    for (const row of rows) {
      const type = row.entity_type as ArchiveEntityType
      if (type in stats) {
        stats[type] = row.count
      }
      stats.total += row.count
    }

    return stats
  }

  /**
   * Restore an item from archive (removes from archive table)
   * Returns the entity data for the caller to re-insert into active storage.
   */
  restore(projectId: string, archiveId: string): unknown | null {
    const record = prjctDb.get<ArchiveRecord>(
      projectId,
      'SELECT * FROM archives WHERE id = ?',
      archiveId
    )

    if (!record) return null

    prjctDb.run(projectId, 'DELETE FROM archives WHERE id = ?', archiveId)

    return JSON.parse(record.entity_data)
  }

  /**
   * Permanently delete archives older than N days
   */
  pruneOldArchives(projectId: string, olderThanDays: number): number {
    const threshold = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

    const before = this.getTotalCount(projectId)
    prjctDb.run(projectId, 'DELETE FROM archives WHERE archived_at < ?', threshold)
    const after = this.getTotalCount(projectId)

    return before - after
  }

  /**
   * Get total count of archived items
   */
  private getTotalCount(projectId: string): number {
    const row = prjctDb.get<{ count: number }>(projectId, 'SELECT COUNT(*) as count FROM archives')
    return row?.count ?? 0
  }
}

export const archiveStorage = new ArchiveStorage()
export default archiveStorage
