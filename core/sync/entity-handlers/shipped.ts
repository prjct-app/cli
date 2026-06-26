/**
 * Shipped entity handler.
 *
 * Shipped is append-only history — `addShipped` is the right shape
 * (no upsert). Dedup happens upstream via content_hash + the
 * sync_pending dedupe at publish time. Delete is intentionally a
 * no-op: shipped history doesn't get rewritten.
 */

import { shippedStorage } from '../../storage/shipped-storage'
import type { EntityHandler } from './types'

export const shippedHandler: EntityHandler = {
  async upsert(projectId, data) {
    await shippedStorage.addShipped(
      projectId,
      {
        name: (data.name as string) || (data.title as string) || '',
        version: (data.version as string) || '',
        description: (data.description as string) || '',
      },
      // Preserve the original ship date through the round trip.
      (data.created_at as string) || (data.shippedAt as string) || (data.shipped_at as string)
    )
  },

  async delete(_projectId, _data) {
    // Append-only history — no-op by design.
  },
}
