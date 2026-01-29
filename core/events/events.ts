/**
 * Event Bus for Sync
 *
 * Events are published on every Storage write/delete.
 * Events accumulate in sync/pending.json until /p:ship or /p:sync.
 */

import pathManager from '../infrastructure/path-manager'
import type { SyncEvent, SyncEventType } from '../types'
import { getTimestamp } from '../utils/date-helper'
import * as fileHelper from '../utils/file-helper'

/**
 * Infer event type from path and action
 */
export function inferEventType(pathArray: string[], action: 'write' | 'delete'): SyncEventType {
  const entity = pathArray[0]

  if (action === 'delete') {
    return `${entity}.deleted` as SyncEventType
  }

  // For writes, we'd need to check if it's new or update
  // For simplicity, use 'updated' (can be refined later)
  return `${entity}.updated` as SyncEventType
}

class EventBus {
  /**
   * Publish event to pending queue
   */
  async publish(event: SyncEvent): Promise<void> {
    const filePath = pathManager.getSyncPendingPath(event.projectId)

    // Read existing pending events
    const pending = (await fileHelper.readJson<SyncEvent[]>(filePath, [])) ?? []

    // Add new event
    pending.push(event)

    // Write back (ensureDir is handled by writeJson)
    await fileHelper.writeJson(filePath, pending)
  }

  /**
   * Get all pending events for a project
   */
  async getPending(projectId: string): Promise<SyncEvent[]> {
    const filePath = pathManager.getSyncPendingPath(projectId)
    return (await fileHelper.readJson<SyncEvent[]>(filePath, [])) ?? []
  }

  /**
   * Clear pending events after successful sync
   */
  async clearPending(projectId: string): Promise<void> {
    const filePath = pathManager.getSyncPendingPath(projectId)
    await fileHelper.writeJson(filePath, [])
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSync(projectId: string): Promise<void> {
    const filePath = pathManager.getLastSyncPath(projectId)

    const data = {
      timestamp: getTimestamp(),
      success: true,
    }

    await fileHelper.writeJson(filePath, data)
  }

  /**
   * Get last sync info
   */
  async getLastSync(projectId: string): Promise<{ timestamp: string; success: boolean } | null> {
    const filePath = pathManager.getLastSyncPath(projectId)
    return await fileHelper.readJson<{ timestamp: string; success: boolean } | null>(filePath, null)
  }
}

export const eventBus = new EventBus()
export default eventBus
