import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { indexProject } from '../../domain/bm25'
import pathManager from '../../infrastructure/path-manager'
import { startTask } from '../../services/task-service'
import { MAIN_WORKSPACE_ID } from '../../services/workspace-id'
import { prjctDb } from '../../storage/database'
import { getTaskPipelineState } from '../../storage/task-pipeline-storage'
import { patchPathManager, restorePathManager } from '../_setup/path-manager-mock'

let tmpRoot: string
let projectId: string
let projectPath: string

describe('task service pipeline orchestration', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-task-service-pipeline-'))
    projectId = `pipeline-service-${Date.now()}`
    projectPath = path.join(tmpRoot, 'repo')
    patchPathManager(tmpRoot)
    await fs.mkdir(pathManager.getStoragePath(projectId, ''), { recursive: true })
    await fs.mkdir(projectPath, { recursive: true })
  })

  afterEach(async () => {
    prjctDb.close()
    restorePathManager()
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
  })

  it('starts trivial work in the direct station', async () => {
    const outcome = await startTask(projectId, projectPath, 'fix typo in README', {
      skipHooks: true,
    })

    expect(outcome.ok).toBe(true)
    expect(outcome.pipeline?.classification).toBe('trivial')
    expect(outcome.pipeline?.station).toBe('direct')
    expect(outcome.pipeline?.nextAction).toContain('Proceed directly')
    expect(outcome.taskId).toBeTruthy()
    expect(getTaskPipelineState(projectId, outcome.taskId ?? '', MAIN_WORKSPACE_ID)?.station).toBe(
      'direct'
    )
  })

  it('starts substantive work in the spec-required test-first station', async () => {
    const outcome = await startTask(
      projectId,
      projectPath,
      'add billing retry handling with failure recovery',
      { skipHooks: true }
    )

    expect(outcome.ok).toBe(true)
    expect(outcome.pipeline?.classification).toBe('substantive')
    expect(outcome.pipeline?.station).toBe('spec_required')
    expect(outcome.pipeline?.nextAction).toContain('Create or link a reviewed spec')
    expect(outcome.pipeline?.nextAction).toContain('tests before implementation')
    expect(
      getTaskPipelineState(projectId, outcome.taskId ?? '', MAIN_WORKSPACE_ID)?.requiresTestsFirst
    ).toBe(true)
  })

  it('surfaces likely files from the project index when work starts', async () => {
    await fs.mkdir(path.join(projectPath, 'core', 'server'), { recursive: true })
    await fs.writeFile(
      path.join(projectPath, 'core', 'server', 'headless-api.ts'),
      'export function mapHeadlessApiEndpoints() { return [] }'
    )
    await fs.writeFile(
      path.join(projectPath, 'core', 'server', 'billing.ts'),
      'export function updateBilling() { return null }'
    )
    await indexProject(projectPath, projectId)

    const outcome = await startTask(projectId, projectPath, 'map headless API endpoints', {
      skipHooks: true,
    })

    expect(outcome.ok).toBe(true)
    expect(outcome.likelyFiles?.[0]?.path).toBe('core/server/headless-api.ts')
    expect(outcome.likelyFiles?.[0]?.signals).toContain('bm25')
  })
})
