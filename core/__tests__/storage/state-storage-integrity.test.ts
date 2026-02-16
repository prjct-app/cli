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

  it('pauseTask preserves business metadata (PRJ-344)', async () => {
    await stateStorage.startTask(
      testProjectId,
      createMockTask({
        description: 'Task with metadata',
        type: 'bug',
        linearId: 'PRJ-344',
        linearUuid: 'uuid-abc-123',
        estimatedPoints: 5,
        estimatedMinutes: 120,
        featureId: 'feat_xyz',
      })
    )
    await stateStorage.pauseTask(testProjectId, 'switching context')

    const state = await stateStorage.read(testProjectId)
    const paused = state.pausedTasks?.[0]
    expect(paused).toBeDefined()
    expect(paused?.description).toBe('Task with metadata')
    expect(paused?.linearId).toBe('PRJ-344')
    expect(paused?.linearUuid).toBe('uuid-abc-123')
    expect(paused?.estimatedPoints).toBe(5)
    expect(paused?.estimatedMinutes).toBe(120)
    expect(paused?.featureId).toBe('feat_xyz')
    expect(paused?.type).toBe('bug')
  })

  it('resumeTask preserves business metadata (PRJ-344)', async () => {
    await stateStorage.startTask(
      testProjectId,
      createMockTask({
        description: 'Task with metadata',
        type: 'feature',
        linearId: 'PRJ-100',
        linearUuid: 'uuid-def-456',
        estimatedPoints: 8,
        featureId: 'feat_abc',
      })
    )
    await stateStorage.pauseTask(testProjectId)
    await stateStorage.resumeTask(testProjectId)

    const state = await stateStorage.read(testProjectId)
    expect(state.currentTask).toBeDefined()
    expect(state.currentTask?.description).toBe('Task with metadata')
    expect(state.currentTask?.linearId).toBe('PRJ-100')
    expect(state.currentTask?.linearUuid).toBe('uuid-def-456')
    expect(state.currentTask?.estimatedPoints).toBe(8)
    expect(state.currentTask?.featureId).toBe('feat_abc')
    expect(state.currentTask?.type).toBe('feature')
  })

  it('resumeTask picks up legacy previousTask (PRJ-345)', async () => {
    // Simulate legacy state: previousTask exists but pausedTasks is empty/missing
    await stateStorage.startTask(
      testProjectId,
      createMockTask({
        description: 'Legacy paused task',
        linearId: 'PRJ-345',
        type: 'bug',
      })
    )
    await stateStorage.pauseTask(testProjectId, 'legacy pause')

    // Manually rewrite state to simulate legacy format: previousTask instead of pausedTasks
    const state = await stateStorage.read(testProjectId)
    const legacyTask = state.pausedTasks?.[0]
    expect(legacyTask).toBeDefined()

    // Write state with legacy previousTask field, empty pausedTasks
    await stateStorage.update(testProjectId, (s) => ({
      ...s,
      previousTask: legacyTask!,
      pausedTasks: [],
    }))

    // Verify legacy state shape
    const legacyState = await stateStorage.read(testProjectId)
    expect(legacyState.pausedTasks?.length).toBe(0)
    expect(legacyState.previousTask).toBeDefined()

    // Resume should pick up the legacy previousTask
    const resumed = await stateStorage.resumeTask(testProjectId)
    expect(resumed).not.toBeNull()
    expect(resumed?.description).toBe('Legacy paused task')
    expect(resumed?.linearId).toBe('PRJ-345')
    expect(resumed?.type).toBe('bug')

    // After resume, previousTask should be cleared
    const finalState = await stateStorage.read(testProjectId)
    expect(finalState.previousTask).toBeNull()
    expect(finalState.pausedTasks?.length).toBe(0)
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
