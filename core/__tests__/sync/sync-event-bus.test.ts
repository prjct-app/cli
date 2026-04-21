import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { syncEventBus } from '../../events/sync-events'
import pathManager from '../../infrastructure/path-manager'
import type { SyncEvent } from '../../types/events'

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

const projectId = 'sync-event-bus-test'
let tmpRoot: string

function makeEvent(type: string): SyncEvent {
  return {
    type,
    path: ['queue'],
    data: {},
    timestamp: '2026-04-17T00:00:00Z',
    projectId,
  }
}

describe('SyncEventBus.publish', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-sync-event-bus-'))
    pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot, id)
    await fs.mkdir(path.join(tmpRoot, projectId, 'sync'), { recursive: true })
  })

  afterEach(async () => {
    pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
    await fs.rm(tmpRoot, { recursive: true, force: true })
  })

  it('recovers when pending.json is not a JSON array', async () => {
    const pendingPath = pathManager.getSyncPendingPath(projectId)
    await fs.writeFile(pendingPath, '{}', 'utf8')

    await syncEventBus.publish(makeEvent('queue.task_added'))

    const written = JSON.parse(await fs.readFile(pendingPath, 'utf8'))
    expect(Array.isArray(written)).toBe(true)
    expect(written).toHaveLength(1)
    expect(written[0].type).toBe('queue.task_added')
  })

  it('getPending returns [] when pending.json is not an array', async () => {
    const pendingPath = pathManager.getSyncPendingPath(projectId)
    await fs.writeFile(pendingPath, '"unexpected-string"', 'utf8')

    const result = await syncEventBus.getPending(projectId)
    expect(result).toEqual([])
  })
})
