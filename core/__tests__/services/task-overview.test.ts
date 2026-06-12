/**
 * Multi-workspace task overview — the observable read side. Asserts that the
 * main currentTask and child-worktree activeTasks[] are merged into one
 * labelled, current-marked list (the output contract), driven off a real DB.
 *
 * `current` is resolved from the caller's projectPath. In tests the path is a
 * plain temp dir (not a git worktree) so it derives to the `main` sentinel —
 * which is exactly the single-agent / main-worktree case.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import type { WorkspaceTask } from '../../schemas/state'
import { collectActiveTasks, formatActiveTaskList } from '../../services/task-overview'
import { prjctDb } from '../../storage/database'
import { stateStorage } from '../../storage/state-storage'
import { patchPathManager, restorePathManager } from '../_setup/path-manager-mock'

let tmpRoot: string | null = null
let projectId: string
let projectPath: string

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-overview-'))
  projectId = `test-ov-${Date.now()}`
  projectPath = path.join(tmpRoot, 'work') // plain dir → main sentinel
  await fs.mkdir(projectPath, { recursive: true })
  patchPathManager(tmpRoot!)
  await fs.mkdir(pathManager.getStoragePath(projectId, ''), { recursive: true })
  await fs.mkdir(path.join(tmpRoot!, projectId, 'sync'), { recursive: true })
})

afterEach(async () => {
  prjctDb.close()
  restorePathManager()
  if (tmpRoot) {
    await fs.rm(tmpRoot, { recursive: true, force: true })
    tmpRoot = null
  }
})

describe('collectActiveTasks', () => {
  it('empty → no current, empty list', async () => {
    const ov = await collectActiveTasks(projectId, projectPath)
    expect(ov.current).toBeNull()
    expect(ov.all).toHaveLength(0)
    expect(formatActiveTaskList(ov)).toBe('No active task.')
  })

  it('main currentTask is the current workspace; child tasks are listed as others', async () => {
    await stateStorage.startTask(projectId, {
      id: 'main-1',
      description: 'main work',
      sessionId: 's-main',
    } as Parameters<typeof stateStorage.startTask>[1])
    await stateStorage.startTaskInWorkspace(
      projectId,
      {
        id: 'child-1',
        description: 'child work',
        sessionId: 's-child',
        workspaceId: 'ws-child',
        branch: 'feat/x',
      } as Omit<WorkspaceTask, 'startedAt'>,
      'ws-child'
    )

    const ov = await collectActiveTasks(projectId, projectPath)
    expect(ov.current?.id).toBe('main-1')
    expect(ov.current?.isCurrent).toBe(true)
    expect(ov.all).toHaveLength(2)

    const child = ov.all.find((v) => v.id === 'child-1')!
    expect(child.isCurrent).toBe(false)
    expect(child.shortId).toBe('ws-chi')
    expect(child.label).toBe('ws-chi · feat/x')

    // Current-first ordering + multi-workspace list rendering.
    expect(ov.all[0]!.isCurrent).toBe(true)
    const rendered = formatActiveTaskList(ov)
    expect(rendered).toContain('Active tasks (2)')
    expect(rendered).toContain('(this worktree)')
  })
})
