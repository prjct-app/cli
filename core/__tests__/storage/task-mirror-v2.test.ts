/**
 * C4: the live work cycle is mirrored into the typed `tasks` table on
 * start/complete (dual-write), so it's queryable without parsing the kv_store
 * state doc. The kv_store state stays the live source for the work loop.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { prjctDb } from '../../storage/database'
import { stateStorage } from '../../storage/state-storage'

let tmpRoot: string
let projectId: string
const orig = pathManager.getGlobalProjectPath.bind(pathManager)
const origStorage = pathManager.getStoragePath.bind(pathManager)
const origFile = pathManager.getFilePath.bind(pathManager)

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-taskmirror-'))
  projectId = `taskmirror-${Date.now()}`
  pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot, id)
  pathManager.getStoragePath = (id: string, f: string) => path.join(tmpRoot, id, 'storage', f)
  pathManager.getFilePath = (id: string, layer: string, f: string) =>
    path.join(tmpRoot, id, layer, f)
  prjctDb.getDb(projectId)
})

afterEach(async () => {
  prjctDb.close()
  pathManager.getGlobalProjectPath = orig
  pathManager.getStoragePath = origStorage
  pathManager.getFilePath = origFile
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

describe('task table mirror (C4)', () => {
  it('mirrors start + complete into the typed tasks table', async () => {
    await stateStorage.startTask(projectId, {
      id: 'task_abc',
      description: 'Wire up the thing',
      sessionId: 'sess_1',
      linkedSpecId: 'spec_9',
    })

    let row = prjctDb.query<{ status: string; description: string; linked_spec_id: string | null }>(
      projectId,
      'SELECT status, description, linked_spec_id FROM tasks WHERE id = ?',
      'task_abc'
    )[0]
    expect(row).toBeDefined()
    expect(row.status).toBe('in_progress')
    expect(row.description).toBe('Wire up the thing')
    expect(row.linked_spec_id).toBe('spec_9')

    await stateStorage.completeTask(projectId)
    row = prjctDb.query<{ status: string; description: string; linked_spec_id: string | null }>(
      projectId,
      'SELECT status, description, linked_spec_id FROM tasks WHERE id = ?',
      'task_abc'
    )[0]
    expect(row.status).toBe('completed')
    const completed = prjctDb.query<{ completed_at: string | null }>(
      projectId,
      'SELECT completed_at FROM tasks WHERE id = ?',
      'task_abc'
    )[0]
    expect(completed.completed_at).toBeTruthy()
  })
})
