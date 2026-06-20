/**
 * Memories entity handler — the highest-value cross-device entity and the one
 * the old wire silently dropped. These pin:
 *  - upsert writes BOTH the events row (source of truth) and the FTS mirror
 *  - identity/idempotency is by (content_hash, type): re-apply is a no-op
 *  - NO echo: applying a pulled memory must not enqueue a sync event
 *  - delete tombstones by content identity
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import prjctDb from '../../storage/database'
import { syncPendingStorage } from '../../storage/sync-pending-storage'
import { memoriesHandler } from '../../sync/entity-handlers/memories'

let tempDir: string
let originalProjectsDir: string | undefined
let projectId: string

function memoryRows(): Array<{
  id: string
  type: string
  content_hash: string
  deleted_at: string | null
}> {
  return prjctDb.query(
    projectId,
    'SELECT id, type, content_hash, deleted_at FROM memories ORDER BY id'
  )
}

function rememberEventCount(): number {
  const row = prjctDb.get<{ cnt: number }>(
    projectId,
    "SELECT COUNT(*) as cnt FROM events WHERE type LIKE 'memory.remember.%'"
  )
  return row?.cnt ?? 0
}

describe('memories entity handler', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-mem-handler-'))
    originalProjectsDir = process.env.PRJCT_PROJECTS_DIR
    process.env.PRJCT_PROJECTS_DIR = tempDir
    projectId = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    // Touch the DB so the schema (events + memories + sync_pending) exists.
    prjctDb.run(projectId, 'SELECT 1 WHERE 1=0')
  })

  afterEach(async () => {
    if (originalProjectsDir === undefined) delete process.env.PRJCT_PROJECTS_DIR
    else process.env.PRJCT_PROJECTS_DIR = originalProjectsDir
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('upsert writes an events row + an FTS mirror row', async () => {
    await memoriesHandler.upsert(projectId, {
      id: 'mem-x',
      type: 'decision',
      content: 'use the unified entity map',
      tags: { topic: 'sync' },
      provenance: 'declared',
    })

    expect(rememberEventCount()).toBe(1)
    const rows = memoryRows()
    expect(rows.length).toBe(1)
    expect(rows[0].type).toBe('decision')
    expect(rows[0].deleted_at).toBeNull()
  })

  test('re-applying the same (content, type) is idempotent (no duplicate)', async () => {
    const data = { id: 'mem-y', type: 'learning', content: 'cursors beat timestamps' }
    await memoriesHandler.upsert(projectId, data)
    await memoriesHandler.upsert(projectId, data)
    await memoriesHandler.upsert(projectId, { ...data, id: 'different-synced-id' })

    expect(memoryRows().length).toBe(1)
    expect(rememberEventCount()).toBe(1)
  })

  test('does NOT echo — applying a pulled memory enqueues no sync event', async () => {
    const before = syncPendingStorage.list(projectId).length
    await memoriesHandler.upsert(projectId, {
      id: 'mem-z',
      type: 'gotcha',
      content: 'pulled memories must not re-publish',
    })
    const after = syncPendingStorage.list(projectId).length
    expect(after).toBe(before)
  })

  test('delete tombstones by content identity', async () => {
    const data = { id: 'mem-d', type: 'fact', content: 'tombstone me' }
    await memoriesHandler.upsert(projectId, data)
    expect(memoryRows()[0].deleted_at).toBeNull()

    await memoriesHandler.delete(projectId, data)
    const rows = prjctDb.query<{ deleted_at: string | null }>(
      projectId,
      'SELECT deleted_at FROM memories'
    )
    expect(rows[0].deleted_at).not.toBeNull()
  })

  test('ignores events missing content or type', async () => {
    await memoriesHandler.upsert(projectId, { id: 'no-content', type: 'decision' })
    await memoriesHandler.upsert(projectId, { id: 'no-type', content: 'orphan' })
    expect(memoryRows().length).toBe(0)
  })
})
