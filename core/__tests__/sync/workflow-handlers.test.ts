/**
 * custom_workflows + workflow_rules pull handlers — completing the workflows
 * group round-trip. custom_workflows keys by name (stable across machines);
 * workflow_rules mirrors by source id (INSERT OR REPLACE). Neither echoes.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import prjctDb from '../../storage/database'
import { syncPendingStorage } from '../../storage/sync-pending-storage'
import { customWorkflowsHandler } from '../../sync/entity-handlers/custom-workflows'
import { workflowRulesHandler } from '../../sync/entity-handlers/workflow-rules'

let tempDir: string
let originalProjectsDir: string | undefined
let projectId: string

describe('workflow entity handlers', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-wf-handler-'))
    originalProjectsDir = process.env.PRJCT_PROJECTS_DIR
    process.env.PRJCT_PROJECTS_DIR = tempDir
    projectId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    prjctDb.run(projectId, 'SELECT 1 WHERE 1=0')
  })

  afterEach(async () => {
    if (originalProjectsDir === undefined) delete process.env.PRJCT_PROJECTS_DIR
    else process.env.PRJCT_PROJECTS_DIR = originalProjectsDir
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('custom_workflows upserts by name (insert then update, no dupe)', async () => {
    await customWorkflowsHandler.upsert(projectId, {
      id: 9,
      name: 'deploy',
      description: 'ship it',
      metadata: { steps: 2 },
      enabled: 1,
      is_builtin: 0,
    })
    await customWorkflowsHandler.upsert(projectId, {
      id: 99, // different source id, same name → still one row
      name: 'deploy',
      description: 'ship it (v2)',
      enabled: 1,
      is_builtin: 0,
    })

    const rows = prjctDb.query<{ name: string; description: string }>(
      projectId,
      'SELECT name, description FROM custom_workflows WHERE name = ?',
      'deploy'
    )
    expect(rows.length).toBe(1)
    expect(rows[0].description).toBe('ship it (v2)')
  })

  test('custom_workflows delete is a no-op — local stays enabled', async () => {
    await customWorkflowsHandler.upsert(projectId, { name: 'temp', enabled: 1, is_builtin: 0 })
    await customWorkflowsHandler.delete(projectId, { name: 'temp' })
    const row = prjctDb.get<{ enabled: number }>(
      projectId,
      'SELECT enabled FROM custom_workflows WHERE name = ?',
      'temp'
    )
    // A remote delete never disables the local workflow.
    expect(row?.enabled).toBe(1)
  })

  test('custom_workflows handler does not echo to the sync queue', async () => {
    const before = syncPendingStorage.list(projectId).length
    await customWorkflowsHandler.upsert(projectId, { name: 'noecho', enabled: 1, is_builtin: 0 })
    expect(syncPendingStorage.list(projectId).length).toBe(before)
  })

  test('workflow_rules upserts by explicit id (replace on re-apply)', async () => {
    await workflowRulesHandler.upsert(projectId, {
      id: 42,
      type: 'gate',
      command: 'ship',
      position: 'before',
      action: 'run tests',
      enabled: 1,
      timeout_ms: 5000,
      sort_order: 0,
    })
    await workflowRulesHandler.upsert(projectId, {
      id: 42,
      type: 'gate',
      command: 'ship',
      position: 'before',
      action: 'run tests AND lint',
      enabled: 1,
      timeout_ms: 5000,
      sort_order: 0,
    })

    const rows = prjctDb.query<{ id: number; action: string }>(
      projectId,
      'SELECT id, action FROM workflow_rules WHERE id = ?',
      42
    )
    expect(rows.length).toBe(1)
    expect(rows[0].action).toBe('run tests AND lint')
  })

  test('workflow_rules delete is a no-op — local row is never removed', async () => {
    await workflowRulesHandler.upsert(projectId, {
      id: 7,
      type: 'step',
      command: 'task',
      position: 'after',
      action: 'note',
    })
    await workflowRulesHandler.delete(projectId, { id: 7 })
    const row = prjctDb.get<{ id: number }>(
      projectId,
      'SELECT id FROM workflow_rules WHERE id = ?',
      7
    )
    // A remote delete never drops the local rule.
    expect(row?.id).toBe(7)
  })

  test('ignores malformed events (missing name / id)', async () => {
    const cw = () =>
      prjctDb.get<{ c: number }>(projectId, 'SELECT COUNT(*) c FROM custom_workflows')?.c ?? 0
    const wr = () =>
      prjctDb.get<{ c: number }>(projectId, 'SELECT COUNT(*) c FROM workflow_rules')?.c ?? 0
    const beforeCw = cw()
    const beforeWr = wr()

    await customWorkflowsHandler.upsert(projectId, { description: 'no name' })
    await workflowRulesHandler.upsert(projectId, { type: 'step' }) // no id

    expect(cw()).toBe(beforeCw)
    expect(wr()).toBe(beforeWr)
  })
})
