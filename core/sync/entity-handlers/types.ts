/**
 * EntityHandler — Strategy contract for `applyEvent` (Phase 1.5
 * follow-up refactor).
 *
 * Each entity_type prjct-cloud mirrors gets one handler that
 * implements `upsert` (idempotent write) and `delete` (tombstone).
 * `sync-manager.applyEvent` looks up the handler from the registry
 * and dispatches — eliminating the two parallel switches that
 * previously sat in apply/delete paths.
 *
 * Adding a new entity is now: write a handler file + one line in
 * `index.ts`. No edits to sync-manager.
 */

export type ApplyData = Record<string, unknown>

export interface EntityHandler {
  /**
   * Idempotent upsert. Either creates a new row or updates the
   * existing row with this id. Must be safe to re-apply (B2).
   */
  upsert(projectId: string, data: ApplyData): Promise<void>

  /**
   * Soft- or hard-delete depending on the entity. Append-only
   * histories (shipped_*) implement this as a no-op.
   */
  delete(projectId: string, data: ApplyData): Promise<void>
}
