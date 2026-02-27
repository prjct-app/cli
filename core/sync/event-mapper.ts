/**
 * Event Mapper - Transforms CLI sync events to web API format
 *
 * CLI sends:  { type, path, data, timestamp, projectId }
 * Web expects: { event_type, entity_type, entity_id, data, project_id }
 */

import type { SyncEvent } from '../types/events'

export interface WebSyncEvent {
  event_type: 'upsert' | 'delete'
  entity_type: string
  entity_id: string
  data: Record<string, unknown>
  project_id: string
}

/**
 * Entity type mapping: CLI entity name → Supabase table name
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

  return {
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    data: { ...data, project_id: projectId },
    project_id: projectId,
  }
}

/**
 * Map multiple CLI SyncEvents to web format, filtering out unmappable events
 */
export function mapCliEventsToWebFormat(projectId: string, events: SyncEvent[]): WebSyncEvent[] {
  return events
    .map((event) => mapCliEventToWebFormat(projectId, event))
    .filter((e): e is WebSyncEvent => e !== null)
}
