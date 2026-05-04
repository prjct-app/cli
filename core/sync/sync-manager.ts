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
// Event normalization (Phase 1.5 / B2)
// ============================================

interface NormalizedEvent {
  entityType: string
  eventType: 'upsert' | 'delete'
  data: Record<string, unknown>
  contentHash?: string
}

/**
 * Normalize an inbound event from either web format
 * (`entity_type` + `event_type`) or legacy CLI format
 * (`type: "entity.action"`). Returns the wire shape applyEvent
 * expects.
 */
function normalizeEventShape(event: Record<string, unknown>): NormalizedEvent {
  const data = (event.data as Record<string, unknown>) ?? {}
  const contentHash =
    (event.content_hash as string | undefined) ?? (event.contentHash as string | undefined)

  if (event.entity_type) {
    const eventType = ((event.event_type as string) || 'upsert') === 'delete' ? 'delete' : 'upsert'
    return {
      entityType: event.entity_type as string,
      eventType,
      data,
      contentHash,
    }
  }

  // entityType field on the new SyncEvent (from B5 producers).
  if (event.entityType) {
    const et = (event.eventType as string) || 'upsert'
    return {
      entityType: event.entityType as string,
      eventType: et === 'delete' ? 'delete' : 'upsert',
      data,
      contentHash,
    }
  }

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
  const tombstone = action === 'deleted' || action === 'archived' || action === 'removed'
  return {
    entityType: legacyEntityMap[entity] || entity || 'unknown',
    eventType: tombstone ? 'delete' : 'upsert',
    data,
    contentHash,
  }
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
   * Pull remote changes from the server.
   *
   * Phase 1.5 / B4: cursor moved from `last-sync.json` (timestamp,
   * clock-skew-prone) to `sync_cursors(user_id, device_id, project_id)
   * → last_event_id`. The legacy timestamp is still sent alongside
   * `sinceEventId` so a pre-1.5 server keeps working.
   */
  async pull(projectId: string): Promise<PullResult> {
    if (!(await this.hasAuth())) {
      return { success: true, skipped: true, reason: 'no_auth' }
    }

    try {
      const { syncCursorStorage } = await import('../storage/sync-cursor-storage')
      const auth = await authConfig.read()
      const deviceId = auth.deviceId ?? null
      const userId = auth.userId ?? null

      const cursor = deviceId ? syncCursorStorage.get(projectId, userId, deviceId) : null
      const sinceEventId = cursor?.lastEventId ?? 0

      const lastSync = await syncEventBus.getLastSync(projectId)
      const sinceTimestamp = lastSync?.timestamp

      const result: SyncPullResult = await syncClient.pullEvents(
        projectId,
        sinceEventId,
        sinceTimestamp
      )

      if (result.events.length === 0) {
        await syncEventBus.updateLastSync(projectId)
        return {
          success: true,
          skipped: false,
          count: 0,
          applied: 0,
          syncedAt: result.syncedAt,
        }
      }

      const applied = await this.applyPulledEvents(projectId, result.events)

      // Advance the cursor to the highest server_event_id we've seen.
      // event records may carry it as `event_id` (web) or `eventId` (B5).
      let highest = sinceEventId
      for (const ev of result.events as Array<Record<string, unknown>>) {
        const candidates = [ev.event_id, ev.eventId]
        for (const c of candidates) {
          if (typeof c === 'number' && c > highest) highest = c
        }
      }
      if (deviceId && highest > sinceEventId) {
        syncCursorStorage.advance(projectId, highest, { userId, deviceId })
      }

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
   * Apply a single pulled event to local storage.
   *
   * Phase 1.5 / B2 rewrite:
   *   - Upsert-by-id (no more `addTask` / `addIdea` that duplicate).
   *   - Honors `event_type === 'delete'` with entity-specific tombstones
   *     (clear-current-task, mark-archived for ideas, drop from queue).
   *   - Idempotency via content_hash: if the incoming hash matches what
   *     we already have, skip the write. Last-write-wins desempata when
   *     two devices update the same entity in parallel — the higher
   *     server_event_id wins (callers feed events in order).
   *
   * Supports both web format (`entity_type` + `event_type`) and legacy
   * CLI format (`type: "entity.action"`). Output is the same.
   */
  private async applyEvent(projectId: string, event: Record<string, unknown>): Promise<void> {
    const normalized = normalizeEventShape(event)
    const { entityType, eventType, data, contentHash } = normalized

    if (eventType === 'delete') {
      await this.applyDelete(projectId, entityType, data)
      return
    }

    // Idempotency check — re-applying the same event is a no-op.
    if (contentHash && (await this.alreadyApplied(projectId, entityType, data, contentHash))) {
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
      case 'shipped_features':
        await this.applyShippedUpsert(projectId, data)
        break
      case 'queue_tasks':
        await this.applyQueueUpsert(projectId, data)
        break
      case 'roadmap_features':
      case 'projects':
        // Roadmap + project config still merged at the sync level.
        // No-op here keeps the pull idempotent.
        break
    }
  }

  /**
   * Apply a delete tombstone. Each entity has its own deletion shape:
   *   - tasks      → clear currentTask if id matches
   *   - ideas      → mark archived in place (soft-delete)
   *   - queue_tasks → drop from the backlog
   *   - shipped_*  → no-op (shipped is append-only history)
   */
  private async applyDelete(
    projectId: string,
    entityType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const id = (data.id as string) || ''
    if (!id && entityType !== 'shipped_items' && entityType !== 'shipped_features') return

    switch (entityType) {
      case 'tasks':
        await stateStorage.update(projectId, (state) => {
          if (state.currentTask?.id === id) {
            return { ...state, currentTask: null }
          }
          return state
        })
        return
      case 'ideas':
        await ideasStorage.update(projectId, (ideas) => ({
          ...ideas,
          ideas: ideas.ideas.map((idea) =>
            idea.id === id ? { ...idea, status: 'archived' as const } : idea
          ),
        }))
        return
      case 'queue_tasks':
        await queueStorage.update(projectId, (queue) => ({
          ...queue,
          tasks: queue.tasks.filter((t) => t.id !== id),
        }))
        return
      default:
        // shipped_* + roadmap_features + projects: no-op.
        return
    }
  }

  /**
   * Idempotency probe: did we already apply an event with this
   * content_hash for this entity? Currently a soft check (returns
   * false on lookup failure so apply proceeds). The persistence story
   * will firm up when we wire content_hash storage on entity rows in
   * a follow-up.
   */
  private async alreadyApplied(
    _projectId: string,
    _entityType: string,
    _data: Record<string, unknown>,
    _contentHash: string
  ): Promise<boolean> {
    // TODO: persist content_hash per (entity_type, entity_id) so we
    //   can short-circuit no-op events. For now the upsert paths below
    //   are themselves idempotent (id-based), so re-applying is safe.
    return false
  }

  private async applyTaskUpsert(projectId: string, data: Record<string, unknown>): Promise<void> {
    const id = (data.id as string) || ''
    if (!id) return
    const status = (data.status as string) || ''

    if (status === 'completed' || status === 'shipped') {
      // Completed task — clear currentTask if it matches; this is the
      // delete-equivalent for `tasks` (history lives in `events`).
      await stateStorage.update(projectId, (state) => {
        if (state.currentTask?.id === id) {
          return { ...state, currentTask: null }
        }
        return state
      })
      return
    }

    if (status === 'active' || data.started_at || data.startedAt) {
      // Upsert into currentTask — replace by id, no append.
      await stateStorage.update(projectId, (state) => ({
        ...state,
        currentTask: {
          id,
          description: data.description as string,
          startedAt:
            (data.started_at as string) || (data.startedAt as string) || new Date().toISOString(),
          sessionId: (data.session_id as string) || (data.sessionId as string) || '',
        },
      }))
      return
    }

    // Backlog task — upsert by id into the queue.
    await queueStorage.update(projectId, (queue) => {
      const existingIdx = queue.tasks.findIndex((t) => t.id === id)
      const next = {
        id,
        description: data.description as string,
        priority: (data.priority as Priority) || 'medium',
        type: (data.type as TaskType) || 'feature',
        section: 'backlog' as TaskSection,
      } as (typeof queue.tasks)[number]
      const tasks =
        existingIdx >= 0
          ? queue.tasks.map((t, i) => (i === existingIdx ? { ...t, ...next } : t))
          : [...queue.tasks, next]
      return { ...queue, tasks }
    })
  }

  private async applyIdeaUpsert(projectId: string, data: Record<string, unknown>): Promise<void> {
    const id = (data.id as string) || ''
    if (!id) return
    const text = (data.title as string) || (data.text as string) || ''
    const priority = (data.priority as IdeaPriority) || 'medium'
    const status = (data.status as string) || 'active'

    await ideasStorage.update(projectId, (ideas) => {
      const existingIdx = ideas.ideas.findIndex((i) => i.id === id)
      const desiredStatus = status === 'archived' ? ('archived' as const) : ('pending' as const)
      const next = {
        id,
        text,
        priority,
        status: desiredStatus,
        addedAt: ideas.ideas[existingIdx]?.addedAt ?? new Date().toISOString(),
        tags: ideas.ideas[existingIdx]?.tags ?? [],
      } as (typeof ideas.ideas)[number]
      const list =
        existingIdx >= 0
          ? ideas.ideas.map((i, idx) => (idx === existingIdx ? { ...i, ...next } : i))
          : [...ideas.ideas, next]
      return { ...ideas, ideas: list }
    })
  }

  private async applyShippedUpsert(
    projectId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    // Shipped is append-only history — `addShipped` is the right shape
    // (no upsert). Dedup happens via content_hash + the sync_pending
    // dedupe upstream.
    await shippedStorage.addShipped(projectId, {
      name: (data.name as string) || (data.title as string) || '',
      version: (data.version as string) || '',
      description: (data.description as string) || '',
    })
  }

  private async applyQueueUpsert(projectId: string, data: Record<string, unknown>): Promise<void> {
    const id = (data.id as string) || ''
    if (!id) {
      // Legacy events without id → fall back to append (preserves old
      // behavior; new events from B1-instrumented storages always carry id).
      await queueStorage.addTask(projectId, {
        description: (data.description as string) || '',
        priority: (data.priority as Priority) || 'medium',
        type: (data.type as TaskType) || 'feature',
        section: (data.section as TaskSection) || 'backlog',
      })
      return
    }

    await queueStorage.update(projectId, (queue) => {
      const existingIdx = queue.tasks.findIndex((t) => t.id === id)
      const next = {
        id,
        description: (data.description as string) || '',
        priority: (data.priority as Priority) || 'medium',
        type: (data.type as TaskType) || 'feature',
        section: (data.section as TaskSection) || 'backlog',
      } as (typeof queue.tasks)[number]
      const tasks =
        existingIdx >= 0
          ? queue.tasks.map((t, i) => (i === existingIdx ? { ...t, ...next } : t))
          : [...queue.tasks, next]
      return { ...queue, tasks }
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
