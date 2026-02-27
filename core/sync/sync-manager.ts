/**
 * Sync Manager - Orchestrates push/pull operations
 *
 * Main entry point for sync operations.
 * Handles the coordination between local storage (EventBus) and remote API (SyncClient).
 */

import { syncEventBus } from '../events/sync-events'
import type { IdeaPriority } from '../schemas/ideas'
import type { Priority, TaskSection, TaskType } from '../schemas/state'
import { ideasStorage } from '../storage/ideas-storage'
import { queueStorage } from '../storage/queue-storage'
import { shippedStorage } from '../storage/shipped-storage'
import { stateStorage } from '../storage/state-storage'
import type { SyncEvent } from '../types/events'
import type {
  PullResult,
  PushResult,
  SyncBatchResult,
  SyncPullResult,
  SyncManagerResult as SyncResult,
  SyncStatus,
} from '../types/sync'
import authConfig from './auth-config'
import { syncClient } from './sync-client'

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
    } catch (_error) {
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
      const pending = await syncEventBus.getPending(projectId)

      if (pending.length === 0) {
        return { success: true, skipped: true, reason: 'no_pending' }
      }

      // Prepend a project upsert event to ensure the project exists on the web side
      const projectEvent = await this.createProjectLinkEvent(projectId)
      const eventsToSend = projectEvent ? [projectEvent, ...pending] : pending

      // Push to server
      const result: SyncBatchResult = await syncClient.pushEvents(projectId, eventsToSend)

      if (result.success) {
        // Clear pending events on success
        await syncEventBus.clearPending(projectId)
        await syncEventBus.updateLastSync(projectId)

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
      const lastSync = await syncEventBus.getLastSync(projectId)
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
      await syncEventBus.updateLastSync(projectId)

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
   * Accepts events in web format (entity_type/event_type) or legacy CLI format (type with dots)
   * Returns number of events successfully applied
   */
  async applyPulledEvents(
    projectId: string,
    events: Array<Record<string, unknown>>
  ): Promise<number> {
    let applied = 0

    for (const event of events) {
      try {
        await this.applyEvent(projectId, event)
        applied++
      } catch (error) {
        const eventLabel = (event.entity_type as string) || (event.type as string) || 'unknown'
        console.error(`Failed to apply event ${eventLabel}:`, error)
      }
    }

    return applied
  }

  /**
   * Apply a single event to local storage
   * Supports both web format (entity_type + event_type) and legacy CLI format (type: "entity.action")
   */
  private async applyEvent(projectId: string, event: Record<string, unknown>): Promise<void> {
    // Normalize: support both web format and legacy CLI format
    let entityType: string
    let eventType: string
    let data: Record<string, unknown>

    if (event.entity_type) {
      // Web format
      entityType = event.entity_type as string
      eventType = event.event_type as string
      data = (event.data as Record<string, unknown>) || {}
    } else {
      // Legacy CLI format: type = "entity.action"
      const [entity, action] = ((event.type as string) || '').split('.')
      const legacyEntityMap: Record<string, string> = {
        task: 'tasks',
        idea: 'ideas',
        feature: 'roadmap_features',
        shipped: 'shipped_items',
        queue: 'queue_tasks',
        project: 'projects',
      }
      entityType = legacyEntityMap[entity] || entity
      eventType = action === 'deleted' ? 'delete' : 'upsert'
      data = (event.data as Record<string, unknown>) || {}
    }

    if (eventType === 'delete') {
      // For deletes, we'd need entity-specific delete logic
      // For now, skip — local storage doesn't support targeted deletes easily
      return
    }

    switch (entityType) {
      case 'tasks':
        await this.applyTaskUpsert(projectId, data)
        break
      case 'ideas':
        await this.applyIdeaUpsert(projectId, data)
        break
      case 'shipped_items':
        await this.applyShippedUpsert(projectId, data)
        break
      case 'queue_tasks':
        await this.applyQueueUpsert(projectId, data)
        break
      case 'roadmap_features':
        // Roadmap data is stored in kv_store as JSON — skip for now
        // as it requires more complex merge logic
        break
      case 'projects':
        // Project config updates are handled at the sync level
        break
    }
  }

  private async applyTaskUpsert(projectId: string, data: Record<string, unknown>): Promise<void> {
    const status = (data.status as string) || ''

    if (status === 'active' || data.started_at || data.startedAt) {
      // Active task — update state
      await stateStorage.update(projectId, (state) => {
        if (!state.currentTask || (data.id as string) !== state.currentTask.id) {
          return {
            ...state,
            currentTask: {
              id: data.id as string,
              description: data.description as string,
              startedAt: (data.started_at as string) || (data.startedAt as string),
              sessionId: (data.session_id as string) || (data.sessionId as string) || '',
            },
          }
        }
        return state
      })
    } else if (status === 'completed') {
      // Clear current task if it matches
      await stateStorage.update(projectId, (state) => {
        if (state.currentTask?.id === data.id) {
          return { ...state, currentTask: null }
        }
        return state
      })
    } else {
      // Queued/backlog task — add to queue
      await queueStorage.addTask(projectId, {
        description: data.description as string,
        priority: (data.priority as Priority) || 'medium',
        type: (data.type as TaskType) || 'feature',
        section: 'backlog' as TaskSection,
      })
    }
  }

  private async applyIdeaUpsert(projectId: string, data: Record<string, unknown>): Promise<void> {
    const status = (data.status as string) || 'active'

    if (status === 'archived') {
      await ideasStorage.update(projectId, (ideas) => ({
        ...ideas,
        ideas: ideas.ideas.map((idea) =>
          idea.id === data.id ? { ...idea, status: 'archived' as const } : idea
        ),
      }))
    } else {
      await ideasStorage.addIdea(projectId, (data.title as string) || (data.text as string) || '', {
        priority: (data.priority as IdeaPriority) || 'medium',
      })
    }
  }

  private async applyShippedUpsert(
    projectId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await shippedStorage.addShipped(projectId, {
      name: (data.name as string) || (data.title as string) || '',
      version: (data.version as string) || '',
      description: (data.description as string) || '',
    })
  }

  private async applyQueueUpsert(projectId: string, data: Record<string, unknown>): Promise<void> {
    await queueStorage.addTask(projectId, {
      description: (data.description as string) || '',
      priority: (data.priority as Priority) || 'medium',
      type: (data.type as TaskType) || 'feature',
      section: (data.section as TaskSection) || 'backlog',
    })
  }

  /**
   * Create a project link event to ensure the web side knows about this CLI project
   */
  private async createProjectLinkEvent(projectId: string): Promise<SyncEvent | null> {
    try {
      return {
        type: 'project.updated',
        path: ['project'],
        data: {
          id: projectId,
          cli_project_id: projectId,
        },
        timestamp: new Date().toISOString(),
        projectId,
      }
    } catch {
      return null
    }
  }
}

export const syncManager = new SyncManager()
export default syncManager
