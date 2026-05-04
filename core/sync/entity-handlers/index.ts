/**
 * Entity handler registry — single lookup table consumed by
 * `sync-manager.applyEvent`.
 *
 * Adding a new entity_type:
 *   1. Write `core/sync/entity-handlers/<entity>.ts` exporting an
 *      `EntityHandler`.
 *   2. Register it here. That's the entire diff.
 *
 * No edits to sync-manager are required — the `applyEvent` lookup
 * is generic over the registry.
 */

import { ideasHandler } from './ideas'
import { queueTasksHandler } from './queue-tasks'
import { shippedHandler } from './shipped'
import { tasksHandler } from './tasks'
import type { EntityHandler } from './types'

/**
 * Map of canonical `entity_type` → handler. The keys mirror the
 * cloud's table names (plural, snake_case).
 */
export const entityHandlers: Record<string, EntityHandler> = {
  tasks: tasksHandler,
  ideas: ideasHandler,
  queue_tasks: queueTasksHandler,
  shipped_items: shippedHandler,
  shipped_features: shippedHandler,
}

/** Read-only list of supported entity types — useful for telemetry. */
export const SUPPORTED_ENTITY_TYPES = Object.keys(entityHandlers)

export type { EntityHandler } from './types'
