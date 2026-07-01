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

export interface WorkflowRunSummary {
  id: string
  command: string
  status: string
  startedAt: number | null
  endedAt: number | null
  steps: number
  gatesPassed: number
  gatesFailed: number
}

/**
 * Recent workflow runs with their step + gate-outcome counts (newest first).
 * Batched as 3 queries total (runs + step counts + gate counts, each grouped
 * by run_id) instead of the previous 1 + limit*3 — a `limit=20` summary
 * issued 61 round-trips before this, each a full scan of the child tables
 * (no index on run_id existed until migration 47).
 */
export function getRecentWorkflowRuns(projectId: string, limit = 20): WorkflowRunSummary[] {
  try {
    const runs = prjctDb.query<{
      id: string
      command: string
      status: string
      started_at: number | null
      ended_at: number | null
    }>(
      projectId,
      'SELECT id, command, status, started_at, ended_at FROM workflow_runs ORDER BY started_at DESC LIMIT ?',
      limit
    )
    if (runs.length === 0) return []

    const placeholders = runs.map(() => '?').join(',')
    const runIds = runs.map((r) => r.id)

    const stepCounts = prjctDb.query<{ run_id: string; n: number }>(
      projectId,
      `SELECT run_id, COUNT(*) AS n FROM workflow_run_step WHERE run_id IN (${placeholders}) GROUP BY run_id`,
      ...runIds
    )
    const gateCounts = prjctDb.query<{ run_id: string; passed: number; n: number }>(
      projectId,
      `SELECT run_id, passed, COUNT(*) AS n FROM gate_evaluation WHERE run_id IN (${placeholders}) GROUP BY run_id, passed`,
      ...runIds
    )

    const stepsByRun = new Map(stepCounts.map((s) => [s.run_id, s.n]))
    const gatesByRun = new Map<string, { passed: number; failed: number }>()
    for (const g of gateCounts) {
      const entry = gatesByRun.get(g.run_id) ?? { passed: 0, failed: 0 }
      if (g.passed) entry.passed = g.n
      else entry.failed = g.n
      gatesByRun.set(g.run_id, entry)
    }

    return runs.map((r) => ({
      id: r.id,
      command: r.command,
      status: r.status,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      steps: stepsByRun.get(r.id) ?? 0,
      gatesPassed: gatesByRun.get(r.id)?.passed ?? 0,
      gatesFailed: gatesByRun.get(r.id)?.failed ?? 0,
    }))
  } catch {
    return []
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
