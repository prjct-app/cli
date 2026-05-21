/**
 * Event Types
 * Types for the event system and sync events.
 */

// Sync Event Types

/**
 * Event for synchronization with backend.
 *
 * Wire format extended in Phase 1.5 (sync engine harden) to carry the
 * fields prjct-cloud needs for correctness:
 *   - `eventId`           — server-assigned monotonic id; absent on
 *                           outbound (set by server after push), present
 *                           on inbound (used as cursor in `since=eventId`).
 *   - `deviceId`          — UUID of the device emitting THIS event.
 *   - `originDeviceId`    — UUID of the device that first created the
 *                           entity. Equals deviceId for INSERTs.
 *   - `contentHash`       — sha256 of `data`; lets `applyEvent` skip
 *                           idempotent updates and last-write-wins
 *                           desempata when two devices write concurrently.
 *   - `revisionCount`     — per-entity revision counter; +1 per update.
 *   - `entityType`        — canonical entity name (tasks, ideas, …).
 *   - `eventType`         — `upsert` | `delete`.
 *   - `entityId`          — id of the entity the event refers to.
 *
 * Pre-1.5 producers (still using legacy `type='entity.action'` strings)
 * keep working — `applyEvent` normalizes both formats. New producers
 * (B1) populate the explicit fields.
 */
export interface SyncEvent {
  /** Legacy compound type `entity.action` — kept for backward compat. */
  type: string
  path: string[]
  data: unknown
  timestamp: string
  projectId: string
  /** Server-assigned monotonic id. Set after push, used as pull cursor. */
  eventId?: number
  /** UUID of the device emitting this event. */
  deviceId?: string
  /** UUID of the device that first created the entity (first-creator). */
  originDeviceId?: string
  /** sha256 of `data` payload — used for idempotency + last-write-wins. */
  contentHash?: string
  /** Per-entity revision counter; +1 per update. */
  revisionCount?: number
  /** Canonical entity name in the event mapper (`tasks`, `ideas`, …). */
  entityType?: string
  /** Discriminator for write vs. tombstone. */
  eventType?: 'upsert' | 'delete'
  /** Stable id of the entity referenced. */
  entityId?: string
}

/**
 * Event type union for sync events
 */
export type SyncEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.completed'
  | 'task.deleted'
  | 'feature.created'
  | 'feature.updated'
  | 'feature.shipped'
  | 'feature.deleted'
  | 'idea.created'
  | 'idea.updated'
  | 'idea.deleted'
  | 'session.started'
  | 'session.completed'
  | 'shipped.created'
  | 'agent.created'
  | 'agent.updated'
  | 'agent.deleted'
  | 'project.updated'
