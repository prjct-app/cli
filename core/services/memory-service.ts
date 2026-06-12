/**
 * MemoryService - Event logging and memory management
 *
 * Handles logging actions to memory for audit trail and context building.
 * Storage: SQLite events table (type prefix: 'memory.')
 */

import configManager from '../infrastructure/config-manager'
import { MEMORY_EVENT_RANGE, REMEMBER_EVENT_RANGE } from '../memory/events'
import { ARCHIVE_POLICIES, archiveStorage } from '../storage/archive-storage'
import prjctDb from '../storage/database'

class MemoryService {
  /**
   * Log an action to memory
   */
  async log(
    projectPath: string,
    action: string,
    data: Record<string, unknown>,
    author?: string
  ): Promise<{ eventId: number | null; projectId: string } | null> {
    try {
      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) return null

      const eventId = prjctDb.appendEvent(projectId, `memory.${action}`, { ...data, author })
      return { eventId, projectId }
    } catch (error) {
      // Non-critical - don't fail the command
      console.error(`Memory log error: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }

  /**
   * Clear memory (for testing or cleanup)
   */
  async clear(projectPath: string): Promise<void> {
    try {
      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) return

      prjctDb.run(
        projectId,
        'DELETE FROM events WHERE type >= ? AND type < ?',
        ...MEMORY_EVENT_RANGE
      )
    } catch (error) {
      console.error(`Memory clear error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Get recent events by projectId (for stats dashboard)
   * @see PRJ-89
   */
  async getRecentEvents(
    projectId: string,
    limit: number = 100
  ): Promise<Record<string, unknown>[]> {
    try {
      const rows = prjctDb.query<{ type: string; data: string; timestamp: string }>(
        projectId,
        'SELECT type, data, timestamp FROM events WHERE type >= ? AND type < ? ORDER BY id DESC LIMIT ?',
        ...MEMORY_EVENT_RANGE,
        limit
      )

      return rows.reverse().map((row) => {
        const parsed = JSON.parse(row.data)
        return {
          timestamp: row.timestamp,
          action: row.type.replace('memory.', ''),
          ...parsed,
        }
      })
    } catch (error) {
      console.error(`Memory read error: ${error instanceof Error ? error.message : String(error)}`)
      return []
    }
  }

  /**
   * Cap memory TELEMETRY at max entries (PRJ-267).
   * Moves overflow entries to archive table, keeps most recent entries.
   * Returns count of archived entries.
   *
   * `memory.remember.*` rows are knowledge — the product's reason to
   * exist — and are NEVER counted or deleted here. The old behavior
   * counted every `memory.%` event together, so high-churn telemetry
   * (`memory.post_edit` fires on every file edit) inflated the total
   * past the cap and the age-ordered delete silently destroyed the
   * OLDEST remembered decisions/gotchas/learnings while keeping
   * hundreds of newer telemetry rows. Knowledge leaves the log through
   * `prjct forget`, deliberately — never through a size cap.
   */
  async capEntries(projectId: string): Promise<number> {
    try {
      const countRow = prjctDb.get<{ cnt: number }>(
        projectId,
        'SELECT COUNT(*) as cnt FROM events WHERE type >= ? AND type < ? AND NOT (type >= ? AND type < ?)',
        ...MEMORY_EVENT_RANGE,
        ...REMEMBER_EVENT_RANGE
      )

      const total = countRow?.cnt ?? 0
      if (total <= ARCHIVE_POLICIES.MEMORY_MAX_ENTRIES) {
        return 0
      }

      const overflow = total - ARCHIVE_POLICIES.MEMORY_MAX_ENTRIES

      // Get the oldest overflow entries for archiving
      const oldestRows = prjctDb.query<{
        id: number
        type: string
        data: string
        timestamp: string
      }>(
        projectId,
        'SELECT id, type, data, timestamp FROM events WHERE type >= ? AND type < ? AND NOT (type >= ? AND type < ?) ORDER BY id ASC LIMIT ?',
        ...MEMORY_EVENT_RANGE,
        ...REMEMBER_EVENT_RANGE,
        overflow
      )

      // Archive overflow entries in batch
      archiveStorage.archiveMany(
        projectId,
        oldestRows.map((row, i) => ({
          entityType: 'memory_entry' as const,
          entityId: `memory-${row.timestamp || i}`,
          entityData: { type: row.type, data: JSON.parse(row.data), timestamp: row.timestamp },
          summary: row.type.replace('memory.', ''),
          reason: 'overflow',
        }))
      )

      // Delete exactly the archived rows — never an id-range sweep,
      // which would take unrelated event types down with it.
      prjctDb.transaction(projectId, (db) => {
        const del = db.prepare('DELETE FROM events WHERE id = ?')
        for (const row of oldestRows) del.run(row.id)
      })

      return overflow
    } catch (error) {
      console.error(`Memory cap error: ${error instanceof Error ? error.message : String(error)}`)
      return 0
    }
  }
}

export const memoryService = new MemoryService()
