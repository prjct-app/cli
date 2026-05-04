/**
 * Sync Cursor Storage — per (user_id, device_id, project_id)
 * → last_event_id (Phase 1.5 / B4).
 *
 * Replaces `last-sync.json`'s wall-clock timestamp cursor. The
 * timestamp version skipped events whenever two devices' clocks
 * disagreed by more than the round-trip latency. The eventId cursor
 * is monotonic on the server side, so pull `since=eventId` is correct
 * regardless of clock skew.
 *
 * NULL `user_id` is allowed because a project may be active before
 * the user authenticates (offline-first). After first auth, the
 * caller backfills user_id once we know it.
 */

import { getTimestamp } from '../utils/date-helper'
import prjctDb from './database'

interface SyncCursorRow {
  user_id: string | null
  device_id: string
  project_id: string
  last_event_id: number
  updated_at: string
}

export interface SyncCursor {
  userId: string | null
  deviceId: string
  projectId: string
  lastEventId: number
  updatedAt: string
}

class SyncCursorStorage {
  /**
   * Read the cursor for the current (user, device) operating on this
   * project. Returns null when no cursor exists yet (first sync).
   */
  get(
    projectId: string,
    userId: string | null = null,
    deviceId: string | null = null
  ): SyncCursor | null {
    if (!deviceId) return null
    const row = prjctDb.get<SyncCursorRow>(
      projectId,
      `SELECT * FROM sync_cursors
       WHERE project_id = ?
         AND device_id = ?
         AND ${userId === null ? 'user_id IS NULL' : 'user_id = ?'}`,
      ...(userId === null ? [projectId, deviceId] : [projectId, deviceId, userId])
    )
    return row ? this.rowToCursor(row) : null
  }

  /**
   * Bump the cursor's `updated_at` without changing `last_event_id`.
   * Useful for "we synced even if there were 0 new events" probes.
   */
  touch(projectId: string, userId: string | null = null, deviceId: string | null = null): void {
    if (!deviceId) return
    const now = getTimestamp()
    this.upsert({
      userId,
      deviceId,
      projectId,
      lastEventId: this.getLastEventId(projectId, userId, deviceId),
      updatedAt: now,
    })
  }

  /**
   * Advance the cursor to a new last_event_id. Idempotent: advancing
   * to an older or equal event id is a no-op.
   */
  advance(
    projectId: string,
    lastEventId: number,
    opts: { userId?: string | null; deviceId?: string | null } = {}
  ): void {
    const userId = opts.userId ?? null
    const deviceId = opts.deviceId ?? null
    if (!deviceId) return
    const current = this.getLastEventId(projectId, userId, deviceId)
    if (lastEventId <= current) return
    this.upsert({
      userId,
      deviceId,
      projectId,
      lastEventId,
      updatedAt: getTimestamp(),
    })
  }

  /** Read just the last_event_id (or 0 if none). */
  getLastEventId(projectId: string, userId: string | null, deviceId: string): number {
    const row = prjctDb.get<{ last_event_id: number }>(
      projectId,
      `SELECT last_event_id FROM sync_cursors
       WHERE project_id = ?
         AND device_id = ?
         AND ${userId === null ? 'user_id IS NULL' : 'user_id = ?'}`,
      ...(userId === null ? [projectId, deviceId] : [projectId, deviceId, userId])
    )
    return row?.last_event_id ?? 0
  }

  /**
   * After auth, backfill the user_id on a previously-anonymous cursor
   * so the device's pre-auth events are preserved against the user's
   * identity going forward.
   */
  backfillUser(projectId: string, deviceId: string, userId: string): void {
    prjctDb.run(
      projectId,
      `UPDATE sync_cursors
       SET user_id = ?, updated_at = ?
       WHERE project_id = ? AND device_id = ? AND user_id IS NULL`,
      userId,
      getTimestamp(),
      projectId,
      deviceId
    )
  }

  private upsert(c: SyncCursor): void {
    prjctDb.run(
      c.projectId,
      `INSERT INTO sync_cursors (user_id, device_id, project_id, last_event_id, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, device_id, project_id)
       DO UPDATE SET last_event_id = excluded.last_event_id, updated_at = excluded.updated_at`,
      c.userId,
      c.deviceId,
      c.projectId,
      c.lastEventId,
      c.updatedAt
    )
  }

  private rowToCursor(row: SyncCursorRow): SyncCursor {
    return {
      userId: row.user_id,
      deviceId: row.device_id,
      projectId: row.project_id,
      lastEventId: row.last_event_id,
      updatedAt: row.updated_at,
    }
  }
}

export const syncCursorStorage = new SyncCursorStorage()
export type { SyncCursorStorage }
