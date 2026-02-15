/**
 * State Storage Integrity Regression Tests (PRJ-343)
 *
 * Ensures task transitions do not drop unrelated state fields.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import type { CurrentTask } from '../../schemas/state'
import { prjctDb } from '../../storage/database'
import { stateStorage } from '../../storage/state-storage'

let tmpRoot: string | null = null
let testProjectId: string

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)
const originalGetStoragePath = pathManager.getStoragePath.bind(pathManager)
const originalGetFilePath = pathManager.getFilePath.bind(pathManager)

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-state-integrity-test-'))
  testProjectId = `test-state-integrity-${Date.now()}`

  pathManager.getGlobalProjectPath = (projectId: string) => {
    return path.join(tmpRoot!, projectId)
  }

  pathManager.getStoragePath = (projectId: string, filename: string) => {
    return path.join(tmpRoot!, projectId, 'storage', filename)
  }

  pathManager.getFilePath = (projectId: string, layer: string, filename: string) => {
    return path.join(tmpRoot!, projectId, layer, filename)
  }

  const storagePath = pathManager.getStoragePath(testProjectId, '')
  await fs.mkdir(storagePath, { recursive: true })

  const syncPath = path.join(tmpRoot!, testProjectId, 'sync')
  await fs.mkdir(syncPath, { recursive: true })
})

afterEach(async () => {
  prjctDb.close()

  pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
  pathManager.getStoragePath = originalGetStoragePath
  pathManager.getFilePath = originalGetFilePath

  if (tmpRoot) {
    await fs.rm(tmpRoot, { recursive: true, force: true })
    tmpRoot = null
  }
})

function createMockTask(
  overrides: Partial<CurrentTask> & Record<string, unknown> = {}
): Omit<CurrentTask, 'startedAt'> {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: 'Test task',
    sessionId: `session-${Date.now()}`,
    ...overrides,
  } as Omit<CurrentTask, 'startedAt'>
}

describe('StateStorage integrity', () => {
  it('pauseTask preserves taskHistory', async () => {
    await stateStorage.startTask(
      testProjectId,
      createMockTask({ description: 'History seed task' })
    )
    await stateStorage.completeTask(testProjectId)

    await stateStorage.startTask(testProjectId, createMockTask({ description: 'Task to pause' }))
    await stateStorage.pauseTask(testProjectId, 'switch context')

    const state = await stateStorage.read(testProjectId)
    expect(state.taskHistory?.length).toBe(1)
    expect(state.taskHistory?.[0]?.title).toBe('History seed task')
    expect(state.pausedTasks?.length).toBe(1)
  })

  it('resumeTask preserves taskHistory', async () => {
    await stateStorage.startTask(
      testProjectId,
      createMockTask({ description: 'History seed task' })
    )
    await stateStorage.completeTask(testProjectId)

    await stateStorage.startTask(testProjectId, createMockTask({ description: 'Task to resume' }))
    await stateStorage.pauseTask(testProjectId)
    await stateStorage.resumeTask(testProjectId)

    const state = await stateStorage.read(testProjectId)
    expect(state.taskHistory?.length).toBe(1)
    expect(state.taskHistory?.[0]?.title).toBe('History seed task')
    expect(state.currentTask?.description).toBe('Task to resume')
    expect(state.pausedTasks?.length).toBe(0)
  })

  it('completeTask preserves existing pausedTasks', async () => {
    await stateStorage.startTask(testProjectId, createMockTask({ description: 'Paused task' }))
    await stateStorage.pauseTask(testProjectId)

    await stateStorage.startTask(testProjectId, createMockTask({ description: 'Task to complete' }))
    await stateStorage.completeTask(testProjectId)

    const state = await stateStorage.read(testProjectId)
    expect(state.pausedTasks?.length).toBe(1)
    expect(state.pausedTasks?.[0]?.description).toBe('Paused task')
    expect(state.taskHistory?.length).toBe(1)
    expect(state.taskHistory?.[0]?.title).toBe('Task to complete')
  })
})
