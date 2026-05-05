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
 * Entity type mapping: CLI entity name → cloud entity table
 */
const ENTITY_TYPE_MAP: Record<string, string> = {
  task: 'tasks',
  idea: 'ideas',
  feature: 'roadmap_features',
  shipped: 'shipped_items',
  queue: 'queue_tasks',
  project: 'projects',
  session: 'sessions',
  agent: 'agents',
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
  const [entity, action] = event.type.split('.') as [string, string]

  const entityType = ENTITY_TYPE_MAP[entity]
  if (!entityType) {
    return null
  }

  const isDelete = action === 'deleted'
  const eventType: 'upsert' | 'delete' = isDelete ? 'delete' : 'upsert'

  const rawData = (event.data || {}) as Record<string, unknown>
  const data = snakeCaseKeys(rawData)

  // Extract entity_id from data
  const entityId = (data.id as string) || (rawData.id as string) || ''

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
