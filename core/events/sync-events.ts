/**
 * Sync Event Bus
 *
 * Events are published on every Storage write/delete.
 * Events accumulate in sync/pending.json until /p:ship or /p:sync.
 */

import pathManager from '../infrastructure/path-manager'
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
  async publish(event: SyncEvent): Promise<void> {
    const filePath = pathManager.getSyncPendingPath(event.projectId)
    const raw = (await fileHelper.readJson<SyncEvent[]>(filePath, [])) ?? []
    const pending = Array.isArray(raw) ? raw : []
    pending.push(event)
    await fileHelper.writeJson(filePath, pending)
  }

  async getPending(projectId: string): Promise<SyncEvent[]> {
    const filePath = pathManager.getSyncPendingPath(projectId)
    const raw = (await fileHelper.readJson<SyncEvent[]>(filePath, [])) ?? []
    return Array.isArray(raw) ? raw : []
  }

  async clearPending(projectId: string): Promise<void> {
    const filePath = pathManager.getSyncPendingPath(projectId)
    await fileHelper.writeJson(filePath, [])
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
