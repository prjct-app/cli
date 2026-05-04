/**
 * Sync Event Bus
 *
 * Events are published on every Storage write/delete and accumulate
 * in the SQLite `sync_pending` table (Phase 1.5 / B3 — was
 * `sync/pending.json`). The JSON file was racy: a CLI write and a
 * WebSocket-applied event landing concurrently could clobber each
 * other. SQLite + WAL serializes the writers.
 *
 * Public API is unchanged (`publish`, `getPending`, `clearPending`,
 * `updateLastSync`, `getLastSync`) so `sync-manager` and the storages
 * don't need to know the durable layer changed.
 *
 * `updateLastSync` / `getLastSync` still write the legacy
 * `last-sync.json` file in B3 — B4 layers `sync_cursors` on top and
 * makes the eventId cursor authoritative.
 */

import pathManager from '../infrastructure/path-manager'
import { syncPendingStorage } from '../storage/sync-pending-storage'
import type { SyncEvent, SyncEventType } from '../types/events'
import { getTimestamp } from '../utils/date-helper'
import * as fileHelper from '../utils/file-helper'

/**
 * Infer event type from path and action
 */
function _inferEventType(pathArray: string[], action: 'write' | 'delete'): SyncEventType {
  const entity = pathArray[0]

  if (action === 'delete') {
    return `${entity}.deleted` as SyncEventType
  }

  return `${entity}.updated` as SyncEventType
}

class SyncEventBus {
  /** Append an event to the durable pending queue. Concurrency-safe. */
  async publish(event: SyncEvent): Promise<void> {
    syncPendingStorage.append(event.projectId, event)
  }

  /** Read all pending events oldest-first (FIFO push order). */
  async getPending(projectId: string): Promise<SyncEvent[]> {
    return syncPendingStorage.list(projectId).map((entry) => entry.event)
  }

  /**
   * Drain the entire pending queue. Use after the server confirms the
   * full batch. For partial confirms, call `getPendingEntries` +
   * `clearPendingByIds` to remove only confirmed rows.
   */
  async clearPending(projectId: string): Promise<void> {
    syncPendingStorage.clearAll(projectId)
  }

  /**
   * Read pending entries with their row ids attached — needed by
   * sync-manager when the server confirms batches partially.
   */
  async getPendingEntries(
    projectId: string
  ): Promise<Array<{ id: number; event: SyncEvent; enqueuedAt: string }>> {
    return syncPendingStorage.list(projectId)
  }

  /** Remove a contiguous prefix of confirmed rows up to `lastId`. */
  async clearPendingUpTo(projectId: string, lastId: number): Promise<number> {
    return syncPendingStorage.clearUpTo(projectId, lastId)
  }

  /** Remove specific rows by id (sparse confirms). */
  async clearPendingByIds(projectId: string, ids: number[]): Promise<void> {
    syncPendingStorage.clearByIds(projectId, ids)
  }

  async updateLastSync(projectId: string): Promise<void> {
    const filePath = pathManager.getLastSyncPath(projectId)
    const data = {
      timestamp: getTimestamp(),
      success: true,
    }
    await fileHelper.writeJson(filePath, data)
  }

  async getLastSync(projectId: string): Promise<{ timestamp: string; success: boolean } | null> {
    const filePath = pathManager.getLastSyncPath(projectId)
    return await fileHelper.readJson<{ timestamp: string; success: boolean } | null>(filePath, null)
  }
}

export const syncEventBus = new SyncEventBus()
export { SyncEventBus }
