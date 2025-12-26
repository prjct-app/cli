/**
 * Event Bus for Sync
 *
 * Events are published on every Storage write/delete.
 * Events accumulate in sync/pending.json until /p:ship or /p:sync.
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'

import { EventType, SyncEvent } from './events.types'

/**
 * Infer event type from path and action
 */
export function inferEventType(pathArray: string[], action: 'write' | 'delete'): EventType {
  const entity = pathArray[0]

  if (action === 'delete') {
    return `${entity}.deleted` as EventType
  }

  // For writes, we'd need to check if it's new or update
  // For simplicity, use 'updated' (can be refined later)
  return `${entity}.updated` as EventType
}

class EventBus {
  private pendingPath(projectId: string): string {
    return path.join(os.homedir(), '.prjct-cli/projects', projectId, 'sync/pending.json')
  }

  /**
   * Publish event to pending queue
   */
  async publish(event: SyncEvent): Promise<void> {
    const filePath = this.pendingPath(event.projectId)

    // Read existing pending events
    let pending: SyncEvent[] = []
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      pending = JSON.parse(content)
    } catch {
      // File doesn't exist yet
    }

    // Add new event
    pending.push(event)

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // Write back
    await fs.writeFile(filePath, JSON.stringify(pending, null, 2), 'utf-8')
  }

  /**
   * Get all pending events for a project
   */
  async getPending(projectId: string): Promise<SyncEvent[]> {
    const filePath = this.pendingPath(projectId)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return []
    }
  }

  /**
   * Clear pending events after successful sync
   */
  async clearPending(projectId: string): Promise<void> {
    const filePath = this.pendingPath(projectId)

    try {
      await fs.writeFile(filePath, '[]', 'utf-8')
    } catch {
      // Ignore
    }
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSync(projectId: string): Promise<void> {
    const filePath = path.join(os.homedir(), '.prjct-cli/projects', projectId, 'sync/last-sync.json')

    const data = {
      timestamp: new Date().toISOString(),
      success: true
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  /**
   * Get last sync info
   */
  async getLastSync(projectId: string): Promise<{ timestamp: string; success: boolean } | null> {
    const filePath = path.join(os.homedir(), '.prjct-cli/projects', projectId, 'sync/last-sync.json')

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }
}

export const eventBus = new EventBus()
export default eventBus

