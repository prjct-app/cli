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

  it('mirrors pause + resume — a paused task no longer reads stale in_progress', async () => {
    await stateStorage.startTask(projectId, {
      id: 'task_pause',
      description: 'Task that gets paused',
      sessionId: 'sess_2',
    })

    await stateStorage.pauseTask(projectId, 'context switch')
    let row = prjctDb.query<{
      status: string
      paused_at: string | null
      pause_reason: string | null
    }>(projectId, 'SELECT status, paused_at, pause_reason FROM tasks WHERE id = ?', 'task_pause')[0]
    expect(row.status).toBe('paused')
    expect(row.paused_at).toBeTruthy()
    expect(row.pause_reason).toBe('context switch')

    await stateStorage.resumeTask(projectId, 'task_pause')
    row = prjctDb.query<{ status: string; paused_at: string | null; pause_reason: string | null }>(
      projectId,
      'SELECT status, paused_at, pause_reason FROM tasks WHERE id = ?',
      'task_pause'
    )[0]
    expect(row.status).toBe('in_progress')
    expect(row.paused_at).toBeNull()
    expect(row.pause_reason).toBeNull()
  })

  it('mirrors workspace (crew/multi-agent) start + complete — previously invisible to the typed table', async () => {
    await stateStorage.startTaskInWorkspace(
      projectId,
      {
        id: 'task_ws',
        description: 'Parallel worktree task',
        sessionId: 'sess_ws',
        workspaceId: 'ws-1',
        worktreePath: '/tmp/worktree-1',
      },
      'ws-1'
    )

    let row = prjctDb.query<{ status: string; description: string }>(
      projectId,
      'SELECT status, description FROM tasks WHERE id = ?',
      'task_ws'
    )[0]
    expect(row).toBeDefined()
    expect(row.status).toBe('in_progress')
    expect(row.description).toBe('Parallel worktree task')

    await stateStorage.completeTaskInWorkspace(projectId, 'ws-1')
    row = prjctDb.query<{ status: string; description: string }>(
      projectId,
      'SELECT status, description FROM tasks WHERE id = ?',
      'task_ws'
    )[0]
    expect(row.status).toBe('completed')
  })
})
