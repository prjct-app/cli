/**
 * syncManager.applyRealtimeEvent — the echo-loop guard + local apply path for
 * events arriving over the realtime channel. And RealtimeManager gating: it
 * must be a no-op outside the daemon.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import prjctDb from '../../storage/database'
import authConfig from '../../sync/auth-config'
import { realtimeManager } from '../../sync/realtime-manager'
import syncManager from '../../sync/sync-manager'

let tempDir: string
let originalProjectsDir: string | undefined
let projectId: string
const origRead = authConfig.read.bind(authConfig)

function memoryCount(): number {
  return (
    prjctDb.get<{ cnt: number }>(projectId, 'SELECT COUNT(*) as cnt FROM memory_entries')?.cnt ?? 0
  )
}

describe('syncManager.applyRealtimeEvent', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-rt-apply-'))
    originalProjectsDir = process.env.PRJCT_PROJECTS_DIR
    process.env.PRJCT_PROJECTS_DIR = tempDir
    projectId = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    prjctDb.run(projectId, 'SELECT 1 WHERE 1=0')
    // This device is "self"; events from it are echoes.
    authConfig.read = mock(async () => ({ deviceId: 'self', userId: 'u1', apiKey: 'k' }) as never)
  })

  afterEach(async () => {
    if (originalProjectsDir === undefined) delete process.env.PRJCT_PROJECTS_DIR
    else process.env.PRJCT_PROJECTS_DIR = originalProjectsDir
    authConfig.read = origRead
    authConfig.clearCache()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('skips echoes from this device (origin === self)', async () => {
    const applied = await syncManager.applyRealtimeEvent(projectId, {
      entity_type: 'memories',
      event_type: 'upsert',
      origin_device_id: 'self',
      data: { id: 'm1', type: 'decision', content: 'echo' },
    })
    expect(applied).toBe(false)
    expect(memoryCount()).toBe(0)
  })

  test('applies events from other devices', async () => {
    const applied = await syncManager.applyRealtimeEvent(projectId, {
      entity_type: 'memories',
      event_type: 'upsert',
      origin_device_id: 'other-machine',
      data: { id: 'm2', type: 'learning', content: 'from machine B' },
    })
    expect(applied).toBe(true)
    expect(memoryCount()).toBe(1)
  })
})

describe('RealtimeManager gating', () => {
  test('not available outside the daemon', () => {
    const prev = process.env.PRJCT_IN_DAEMON
    delete process.env.PRJCT_IN_DAEMON
    expect(realtimeManager.available()).toBe(false)
    if (prev !== undefined) process.env.PRJCT_IN_DAEMON = prev
  })

  test('startAll is a no-op when not available; status is "disabled"', async () => {
    const prev = process.env.PRJCT_IN_DAEMON
    delete process.env.PRJCT_IN_DAEMON
    await realtimeManager.startAll()
    expect(realtimeManager.status('whatever')).toBe('disabled')
    if (prev !== undefined) process.env.PRJCT_IN_DAEMON = prev
  })
})
