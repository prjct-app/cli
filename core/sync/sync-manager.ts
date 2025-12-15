/**
 * Sync Manager - Orchestrates push/pull operations
 *
 * Main entry point for sync operations.
 * Handles the coordination between local storage (EventBus) and remote API (SyncClient).
 */

import { syncClient, type SyncBatchResult, type SyncPullResult, type SyncStatus } from './sync-client'
import authConfig from './auth-config'
import eventBus, { type SyncEvent } from '../events'
import { stateStorage } from '../storage/state-storage'
import { queueStorage } from '../storage/queue-storage'
import { ideasStorage, type IdeaPriority } from '../storage/ideas-storage'
import { shippedStorage } from '../storage/shipped-storage'
import type { TaskType, Priority, TaskSection } from '../schemas/state'

// ============================================
// Types
// ============================================

export interface SyncResult {
  success: boolean
  skipped: boolean
  reason?: 'no_auth' | 'no_pending' | 'error'
  pushed?: {
    count: number
    syncedAt: string
  }
  pulled?: {
    count: number
    syncedAt: string
  }
  error?: string
}

export interface PushResult {
  success: boolean
  skipped: boolean
  reason?: 'no_auth' | 'no_pending' | 'error'
  count?: number
  syncedAt?: string
  error?: string
}

export interface PullResult {
  success: boolean
  skipped: boolean
  reason?: 'no_auth' | 'error'
  count?: number
  applied?: number
  syncedAt?: string
  error?: string
}

// ============================================
// Sync Manager
// ============================================

class SyncManager {
  /**
   * Check if user is authenticated
   */
  async hasAuth(): Promise<boolean> {
    return await authConfig.hasAuth()
  }

  /**
   * Get sync status from API
   */
  async getStatus(projectId: string): Promise<SyncStatus | null> {
    if (!(await this.hasAuth())) {
      return null
    }

    try {
      return await syncClient.getStatus(projectId)
    } catch {
      return null
    }
  }

  /**
   * Full sync: push local changes, then pull remote changes
   */
  async sync(projectId: string): Promise<SyncResult> {
    // Check auth first
    if (!(await this.hasAuth())) {
      return { success: true, skipped: true, reason: 'no_auth' }
    }

    const result: SyncResult = { success: true, skipped: false }

    // Push first
    const pushResult = await this.push(projectId)
    if (pushResult.success && !pushResult.skipped) {
      result.pushed = {
        count: pushResult.count || 0,
        syncedAt: pushResult.syncedAt || new Date().toISOString(),
      }
    }

    // Then pull
    const pullResult = await this.pull(projectId)
    if (pullResult.success && !pullResult.skipped) {
      result.pulled = {
        count: pullResult.count || 0,
        syncedAt: pullResult.syncedAt || new Date().toISOString(),
      }
    }

    // Determine overall success
    if (!pushResult.success || !pullResult.success) {
      result.success = false
      result.error = pushResult.error || pullResult.error
    }

    return result
  }

  /**
   * Push local pending events to the server
   */
  async push(projectId: string): Promise<PushResult> {
    // Check auth first
    if (!(await this.hasAuth())) {
      return { success: true, skipped: true, reason: 'no_auth' }
    }

    try {
      // Get pending events
      const pending = await eventBus.getPending(projectId)

      if (pending.length === 0) {
        return { success: true, skipped: true, reason: 'no_pending' }
      }

      // Push to server
      const result: SyncBatchResult = await syncClient.pushEvents(projectId, pending)

      if (result.success) {
        // Clear pending events on success
        await eventBus.clearPending(projectId)
        await eventBus.updateLastSync(projectId)

        return {
          success: true,
          skipped: false,
          count: result.processed,
          syncedAt: result.syncedAt,
        }
      } else {
        // Partial success - some events failed
        const successCount = result.processed
        const errorCount = result.errors.length
        const errorMessages = result.errors.map((e) => e.error).join(', ')

        return {
          success: false,
          skipped: false,
          count: successCount,
          syncedAt: result.syncedAt,
          error: `${errorCount} events failed: ${errorMessages}`,
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        skipped: false,
        reason: 'error',
        error: message,
      }
    }
  }

  /**
   * Pull remote changes from the server
   */
  async pull(projectId: string): Promise<PullResult> {
    // Check auth first
    if (!(await this.hasAuth())) {
      return { success: true, skipped: true, reason: 'no_auth' }
    }

    try {
      // Get last sync timestamp
      const lastSync = await eventBus.getLastSync(projectId)
      const since = lastSync?.timestamp

      // Pull from server
      const result: SyncPullResult = await syncClient.pullEvents(projectId, since)

      if (result.events.length === 0) {
        return {
          success: true,
          skipped: false,
          count: 0,
          applied: 0,
          syncedAt: result.syncedAt,
        }
      }

      // Apply pulled events to local storage
      const applied = await this.applyPulledEvents(projectId, result.events)

      // Update last sync timestamp
      await eventBus.updateLastSync(projectId)

      return {
        success: true,
        skipped: false,
        count: result.events.length,
        applied,
        syncedAt: result.syncedAt,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        skipped: false,
        reason: 'error',
        error: message,
      }
    }
  }

  /**
   * Apply pulled events to local storage
   * Returns number of events successfully applied
   */
  async applyPulledEvents(
    projectId: string,
    events: Array<{ type: string; path: string[]; data: unknown; timestamp: string }>
  ): Promise<number> {
    let applied = 0

    for (const event of events) {
      try {
        await this.applyEvent(projectId, event)
        applied++
      } catch (error) {
        // Log but continue with other events
        console.error(`Failed to apply event ${event.type}:`, error)
      }
    }

    return applied
  }

  /**
   * Apply a single event to local storage
   */
  private async applyEvent(
    projectId: string,
    event: { type: string; path: string[]; data: unknown; timestamp: string }
  ): Promise<void> {
    const [entity, action] = event.type.split('.') as [string, string]
    const data = event.data as Record<string, unknown>

    switch (entity) {
      case 'task':
        await this.applyTaskEvent(projectId, action, data)
        break
      case 'idea':
        await this.applyIdeaEvent(projectId, action, data)
        break
      case 'shipped':
        await this.applyShippedEvent(projectId, action, data)
        break
      // Add more entity handlers as needed
    }
  }

  private async applyTaskEvent(
    projectId: string,
    action: string,
    data: Record<string, unknown>
  ): Promise<void> {
    switch (action) {
      case 'started':
        // Update state if this is a newer task
        await stateStorage.update(projectId, (state) => {
          if (!state.currentTask || (data.id as string) !== state.currentTask.id) {
            return {
              ...state,
              currentTask: {
                id: data.id as string,
                description: data.description as string,
                startedAt: data.startedAt as string,
                sessionId: data.sessionId as string,
              },
            }
          }
          return state
        })
        break
      case 'completed':
        // Clear current task if it matches
        await stateStorage.update(projectId, (state) => {
          if (state.currentTask?.id === data.id) {
            return { ...state, currentTask: null }
          }
          return state
        })
        break
      case 'created':
        // Add to queue
        await queueStorage.addTask(projectId, {
          description: data.description as string,
          priority: (data.priority as Priority) || 'medium',
          type: (data.type as TaskType) || 'feature',
          section: 'backlog' as TaskSection,
        })
        break
    }
  }

  private async applyIdeaEvent(
    projectId: string,
    action: string,
    data: Record<string, unknown>
  ): Promise<void> {
    switch (action) {
      case 'created':
        await ideasStorage.addIdea(
          projectId,
          (data.title as string) || (data.text as string),
          { priority: (data.priority as IdeaPriority) || 'medium' }
        )
        break
      case 'archived':
        await ideasStorage.update(projectId, (ideas) => ({
          ...ideas,
          ideas: ideas.ideas.map((idea) =>
            idea.id === data.id ? { ...idea, status: 'archived' as const } : idea
          ),
        }))
        break
    }
  }

  private async applyShippedEvent(
    projectId: string,
    action: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (action === 'created') {
      await shippedStorage.addShipped(projectId, {
        name: (data.name as string) || (data.title as string),
        version: data.version as string,
        description: data.description as string,
      })
    }
  }
}

export const syncManager = new SyncManager()
export default syncManager
