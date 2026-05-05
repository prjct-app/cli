/**
 * Sync Manager - Orchestrates push/pull operations
 *
 * Main entry point for sync operations.
 * Handles the coordination between local storage (EventBus) and remote API (SyncClient).
 */

import { syncEventBus } from '../events/sync-events'
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
import { entityHandlers, UNKNOWN_ENTITY_TYPES } from './entity-handlers'
import { clearApplied, getApplied, recordApplied } from './sync-applied-hashes'
import { syncClient } from './sync-client'

// Per-process dedupe for the "no local handler" warn — without this,
// pulling a batch of 50 events for an unhandled entity_type would emit
// 50 identical warns. Reset on process restart, which is fine: the warn
// is a development-time signal, not a production log line.
const WARN_LOGGED: Set<string> = new Set()

function warnNoLocalHandler(entityType: string): void {
  if (WARN_LOGGED.has(entityType)) return
  WARN_LOGGED.add(entityType)
  const known = UNKNOWN_ENTITY_TYPES.has(entityType)
  const reason = known
    ? 'CLI does not track this entity locally yet — see Phase 2 spec'
    : 'no local handler registered'
  console.warn(
    `[sync] apply skipped: entity_type='${entityType}' (${reason}). code=no_local_handler`
  )
}

/**
 * @internal — exposed for tests so a fresh process state can be
 * simulated without spawning a child. Do not call from prod code.
 */
export function _resetWarnDedupeForTest(): void {
  WARN_LOGGED.clear()
}

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
   * Phase 1.5 / B2 + handler-registry refactor:
   *   - Upsert-by-id (no more `addTask` / `addIdea` that duplicate).
   *   - Honors `event_type === 'delete'` with entity-specific
   *     tombstones (clear-current-task, mark-archived for ideas,
   *     drop from queue, no-op for append-only shipped_*).
   *   - The per-entity logic lives in `core/sync/entity-handlers/`;
   *     this method just normalizes the event shape and dispatches.
   *     Adding a new entity_type = new handler file + 1 line in the
   *     registry. No edits here.
   *   - Idempotency via content_hash: if the incoming hash matches
   *     what we already have, skip. Last-write-wins desempata when
   *     two devices update the same entity in parallel — the higher
   *     server_event_id wins (callers feed events in order).
   *
   * Supports both web format (`entity_type` + `event_type`) and legacy
   * CLI format (`type: "entity.action"`). Output is the same.
   */
  private async applyEvent(projectId: string, event: Record<string, unknown>): Promise<void> {
    const { entityType, eventType, data, contentHash } = normalizeEventShape(event)
    const entityId = (data.id as string | undefined) ?? ''

    const handler = entityHandlers[entityType]
    if (!handler) {
      // Phase 1.6 / B3: emit a stable warn instead of returning
      // silently. Known unhandled types (roadmap_features, projects)
      // are listed in UNKNOWN_ENTITY_TYPES; brand-new types not on
      // either list still warn so a CI exhaustiveness test can flag
      // them. Per-process dedupe keeps batch pulls quiet.
      warnNoLocalHandler(entityType)
      return
    }

    if (eventType === 'delete') {
      // Deletes are id-idempotent in the handlers themselves AND must
      // not be deduped by the upsert hash trail. Otherwise a delete
      // following an upsert with the same content_hash would short-
      // circuit and the entity would never be removed locally.
      await handler.delete(projectId, data)
      if (entityId) clearApplied(projectId, entityType, entityId)
      return
    }

    // Upsert path: idempotency probe first (Phase 1.6 / B2). If this
    // entity's last applied content_hash matches the incoming one,
    // skip the handler — re-apply would be a no-op.
    if (contentHash && this.alreadyApplied(projectId, entityType, entityId, contentHash)) {
      return
    }

    await handler.upsert(projectId, data)
    // Record AFTER handler success — handler durability is the source
    // of truth, this just trails what we last applied.
    if (contentHash && entityId) {
      recordApplied(projectId, entityType, entityId, contentHash)
    }
  }

  /**
   * Idempotency probe: did we already apply an event with this
   * content_hash for this entity? Reads sync_applied_hashes side table
   * (migration 19). Returns false on missing entityId, missing row, or
   * lookup error — apply proceeds rather than blocking.
   */
  private alreadyApplied(
    projectId: string,
    entityType: string,
    entityId: string,
    contentHash: string
  ): boolean {
    if (!entityId) return false
    const last = getApplied(projectId, entityType, entityId)
    return last !== null && last === contentHash
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
