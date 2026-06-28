/**
 * ShippedStorage.republishShips — one-time historical-ship backfill.
 *
 * Ships shipped before the canonical-event fix were emitted off-contract
 * (`feature.shipped` → `features`) and dropped at /sync/batch. republishShips
 * re-emits every locally-stored ship as `shipped_item.created` (entity_type
 * `shipped_items`, top-level `id`) so they finally reach the cloud — guarded by
 * a per-project kv flag so it runs exactly once.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { syncEventBus } from '../../events/sync-events'
import prjctDb from '../../storage/database'
import { shippedStorage } from '../../storage/shipped-storage'

let tempProjectsDir: string
let originalProjectsDir: string | undefined
let projectId: string

describe('ShippedStorage.republishShips backfill', () => {
  beforeEach(async () => {
    tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-ship-backfill-'))
    originalProjectsDir = process.env.PRJCT_PROJECTS_DIR
    process.env.PRJCT_PROJECTS_DIR = tempProjectsDir
    projectId = `ship-bf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    prjctDb.run(projectId, 'SELECT 1 WHERE 1=0')
  })

  afterEach(async () => {
    if (originalProjectsDir === undefined) delete process.env.PRJCT_PROJECTS_DIR
    else process.env.PRJCT_PROJECTS_DIR = originalProjectsDir
    await fs.rm(tempProjectsDir, { recursive: true, force: true })
  })

  test('re-publishes each local ship as a canonical shipped_items event, exactly once', async () => {
    await shippedStorage.addShipped(projectId, { name: 'Auth', version: '1.0.0' })
    await shippedStorage.addShipped(projectId, { name: 'Billing', version: '1.1.0' })
    // Isolate the backfill from the addShipped publishes above.
    await syncEventBus.clearPending(projectId)

    const count = await shippedStorage.republishShips(projectId)
    expect(count).toBe(2)

    const pending = await syncEventBus.getPending(projectId)
    const ships = pending.filter((e) => e.entityType === 'shipped_items')
    expect(ships.length).toBe(2)
    for (const e of ships) {
      expect(e.eventType).toBe('upsert')
      expect(e.entityId).toBeTruthy() // recognized via top-level `id`
      expect((e.data as Record<string, unknown>).id).toBe(e.entityId)
    }

    // Second run is a no-op — the per-project flag is set.
    await syncEventBus.clearPending(projectId)
    const again = await shippedStorage.republishShips(projectId)
    expect(again).toBe(0)
    const pendingAfter = await syncEventBus.getPending(projectId)
    expect(pendingAfter.filter((e) => e.entityType === 'shipped_items').length).toBe(0)
  })
})
