/**
 * Event Mapper - Transforms CLI sync events to web API format
 *
 * CLI sends:  { type, path, data, timestamp, projectId, originDeviceId?, contentHash?, revisionCount? }
 * Web expects: { event_type, entity_type, entity_id, data, project_id, origin_device_id?, content_hash?, revision_count?, ts? }
 *
 * Phase 1.6 / B1: the wire payload now propagates `originDeviceId`,
 * `contentHash`, `revisionCount`, and the event's `timestamp` (as `ts`)
 * as TOP-LEVEL fields. Server-side filtering (echo-loop prevention,
 * LWW dedupe) reads these without parsing `data`. Fields are optional —
 * legacy events that don't carry them still produce valid payloads.
 *
 * `project_id` continues to appear BOTH at the top level AND inside
 * `data` (the historical shape) so existing consumers reading from
 * `data.project_id` keep working.
 */

import type { SyncEvent } from '../types/events'
import { toCloudTable } from './entity-map'

interface WebSyncEvent {
  event_type: 'upsert' | 'delete'
  entity_type: string
  entity_id: string
  data: Record<string, unknown>
  project_id: string
  /** UUID of the device that first created the entity (Phase 1.6/B1). */
  origin_device_id?: string
  /** sha256 of the canonicalized data payload (Phase 1.6/B1). */
  content_hash?: string
  /** Per-entity revision counter, +1 per update (Phase 1.6/B1). */
  revision_count?: number
  /** ISO timestamp from the CLI emit (Phase 1.6/B1). */
  ts?: string
}

/**
 * Convert camelCase keys to snake_case
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/**
 * Convert all camelCase keys in an object to snake_case
 */
function snakeCaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value
  }
  return result
}

/**
 * Map a single CLI SyncEvent to web format
 */
export function mapCliEventToWebFormat(projectId: string, event: SyncEvent): WebSyncEvent | null {
  const [legacyEntity, legacyAction] = event.type.split('.') as [string, string]

  // Prefer the wire-ready top-level `entityType` (set by every publishCRUD
  // producer); fall back to the legacy `type` split for pre-1.5 events.
  // Both resolve through the single canonical table map so no producer is
  // silently dropped (the old map missed memories, queue_task, workflows…).
  const entityType = toCloudTable(event.entityType) ?? toCloudTable(legacyEntity)
  if (!entityType) {
    return null
  }

  // Prefer the explicit `eventType`; else infer a tombstone from the action.
  const isDelete =
    event.eventType === 'delete' ||
    legacyAction === 'deleted' ||
    legacyAction === 'archived' ||
    legacyAction === 'removed'
  const eventType: 'upsert' | 'delete' = isDelete ? 'delete' : 'upsert'

  const rawData = (event.data || {}) as Record<string, unknown>
  const data = snakeCaseKeys(rawData)

  // Extract entity_id: explicit field wins, then common payload keys.
  // Work-cycle producers (`task.started` / `.paused` / `.resumed` / `.completed`)
  // put the id in `taskId` (→ `task_id`), not `id`. Without this fallback the
  // cloud row lands with empty entity_id and work never appears to sync.
  const entityId =
    event.entityId ||
    (typeof data.id === 'string' ? data.id : '') ||
    (typeof rawData.id === 'string' ? rawData.id : '') ||
    (typeof data.task_id === 'string' ? data.task_id : '') ||
    (typeof rawData.taskId === 'string' ? rawData.taskId : '') ||
    (typeof data.entity_id === 'string' ? data.entity_id : '') ||
    ''

  // Normalize so cloud consumers always see `id` even when the producer only
  // set taskId / entity_id aliases.
  if (entityId && data.id == null) data.id = entityId

  const out: WebSyncEvent = {
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    data: { ...data, project_id: projectId },
    project_id: projectId,
  }

  // Phase 1.6 / B1: propagate the 3 dedupe/echo fields and the event
  // timestamp top-level when the producer populated them. Don't write
  // `undefined` keys — keep the wire payload compact and let JSON
  // serialization elide them.
  if (event.originDeviceId !== undefined) out.origin_device_id = event.originDeviceId
  if (event.contentHash !== undefined) out.content_hash = event.contentHash
  if (event.revisionCount !== undefined) out.revision_count = event.revisionCount
  if (event.timestamp) out.ts = event.timestamp

  return out
}

/**
 * Map multiple CLI SyncEvents to web format, filtering out unmappable events
 */
export function mapCliEventsToWebFormat(projectId: string, events: SyncEvent[]): WebSyncEvent[] {
  return events
    .map((event) => mapCliEventToWebFormat(projectId, event))
    .filter((e): e is WebSyncEvent => e !== null)
}
