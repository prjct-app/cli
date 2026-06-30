/**
 * C8: workflow execution is persisted via the run-recorder — workflow_runs,
 * gate_evaluation, workflow_run_step. Tests the persistence layer directly
 * (deterministic); the engine wiring is covered by typecheck + the existing
 * workflow-engine suites.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import prjctDb from '../../storage/database'
import {
  finishWorkflowRun,
  recordGateEvaluation,
  recordRunStep,
  startWorkflowRun,
} from '../../workflow-engine/run-recorder'

let tmpRoot: string
let projectId: string
const original = pathManager.getGlobalProjectPath.bind(pathManager)

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-wfrun-'))
  projectId = `wfrun-${Math.random().toString(36).slice(2, 10)}`
  pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot, id)
  prjctDb.getDb(projectId)
})
afterEach(async () => {
  prjctDb.close()
  pathManager.getGlobalProjectPath = original
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

describe('workflow run recorder (C8)', () => {
  it('persists a run with a gate eval and a step, then finalizes status', () => {
    const runId = startWorkflowRun(projectId, 'before:ship', 'task-1')
    expect(runId).toBeTruthy()
    recordGateEvaluation(projectId, runId, 7, true)
    recordGateEvaluation(projectId, runId, 8, false, 'tests red')
    recordRunStep(projectId, runId, 9, 0, 'ok')
    finishWorkflowRun(projectId, runId, 'passed')

    const run = prjctDb.query<{ status: string; command: string; work_cycle_id: string }>(
      projectId,
      'SELECT status, command, work_cycle_id FROM workflow_runs WHERE id = ?',
      runId
    )[0]
    expect(run.status).toBe('passed')
    expect(run.command).toBe('before:ship')
    expect(run.work_cycle_id).toBe('task-1')

    const gates = prjctDb.query<{ passed: number; reason: string | null }>(
      projectId,
      'SELECT passed, reason FROM gate_evaluation WHERE run_id = ? ORDER BY passed DESC',
      runId
    )
    expect(gates.length).toBe(2)
    expect(gates[0].passed).toBe(1)
    expect(gates[1].passed).toBe(0)
    expect(gates[1].reason).toBe('tests red')

    const steps = prjctDb.query<{ status: string; seq: number }>(
      projectId,
      'SELECT status, seq FROM workflow_run_step WHERE run_id = ?',
      runId
    )
    expect(steps.length).toBe(1)
    expect(steps[0].status).toBe('ok')
  })

  it('recorder calls with a null runId are no-ops (never throw)', () => {
    expect(() => {
      recordGateEvaluation(projectId, null, 1, true)
      recordRunStep(projectId, null, 1, 0, 'ok')
      finishWorkflowRun(projectId, null, 'passed')
    }).not.toThrow()
    const runs = prjctDb.query<{ id: string }>(projectId, 'SELECT id FROM workflow_runs')
    expect(runs.length).toBe(0)
  })
})
