/**
 * Schema v2 (C8): persist workflow execution that used to be ephemeral —
 * workflow_runs (one per executeWorkflowRules invocation that has rules),
 * gate_evaluation (every gate outcome, pass or fail), and workflow_run_step
 * (every step). Makes gates/runs auditable and queryable, and gives loops a
 * place to live (iteration/attempt columns). Entirely best-effort: recording
 * must never affect or block workflow execution.
 */

import { generateUUID } from '../schemas/schemas'
import prjctDb from '../storage/database'

export function startWorkflowRun(
  projectId: string,
  command: string,
  workCycleId?: string | null
): string | null {
  try {
    const id = generateUUID()
    prjctDb.run(
      projectId,
      `INSERT INTO workflow_runs
         (id, project_id, command, work_cycle_id, status, iteration, max_iterations, started_at)
       VALUES (?, ?, ?, ?, 'running', 0, NULL, ?)`,
      id,
      projectId,
      command,
      workCycleId ?? null,
      Date.now()
    )
    return id
  } catch {
    return null
  }
}

export function recordGateEvaluation(
  projectId: string,
  runId: string | null,
  ruleId: string | number,
  passed: boolean,
  reason?: string
): void {
  if (!runId) return
  try {
    prjctDb.run(
      projectId,
      `INSERT INTO gate_evaluation (id, run_id, rule_id, passed, reason, evaluated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      generateUUID(),
      runId,
      String(ruleId),
      passed ? 1 : 0,
      reason ?? null,
      Date.now()
    )
  } catch {
    /* best-effort */
  }
}

export function recordRunStep(
  projectId: string,
  runId: string | null,
  ruleId: string | number,
  seq: number,
  status: 'ok' | 'failed' | 'skipped',
  output?: string
): void {
  if (!runId) return
  try {
    prjctDb.run(
      projectId,
      `INSERT INTO workflow_run_step (id, run_id, rule_id, seq, status, attempt, output, ended_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      generateUUID(),
      runId,
      String(ruleId),
      seq,
      status,
      output ?? null,
      Date.now()
    )
  } catch {
    /* best-effort */
  }
}

export function finishWorkflowRun(
  projectId: string,
  runId: string | null,
  status: 'passed' | 'blocked' | 'failed'
): void {
  if (!runId) return
  try {
    prjctDb.run(
      projectId,
      'UPDATE workflow_runs SET status = ?, ended_at = ? WHERE id = ?',
      status,
      Date.now(),
      runId
    )
  } catch {
    /* best-effort */
  }
}
