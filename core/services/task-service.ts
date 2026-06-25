/**
 * Task service — the non-printing core of `prjct task` and `prjct status`.
 *
 * Extracted so the MCP write-path (`prjct_task_start` / `prjct_task_set_status`)
 * fires the SAME gates, memory logs, spec linkage, and state-machine
 * transitions as the CLI — without the CLI's stdout writes, which would
 * corrupt the MCP stdio JSON-RPC stream. The command layer (workflow.now /
 * primitives.status) calls these and owns presentation; the MCP tools call
 * these and format their own text. One behavior, two front-ends, zero drift.
 *
 * Side-effect notes (must match the CLI byte-for-byte):
 *  - `startTask` logs `task_started` WITH author (CLI used `logToMemory`).
 *  - `setTaskStatus` logs `STATUS_CHANGE_ACTION` WITHOUT author (CLI called
 *    `memoryService.log` directly).
 *  - `memoryService.log` only ever writes to stderr on failure, never stdout,
 *    so it is safe under MCP stdio.
 */

import configManager from '../infrastructure/config-manager'
import { STATUS_CHANGE_ACTION } from '../memory/events'
import { generateUUID } from '../schemas/schemas'
import type { CurrentTask, TaskFeedback, TaskHarness } from '../schemas/state'
import { getGitBranch } from '../session/git-helpers'
import { stateStorage } from '../storage/state-storage'
import { upsertTaskPipelineState } from '../storage/task-pipeline-storage'
import * as dateHelper from '../utils/date-helper'
import { executeWorkflowRules } from '../workflow-engine/workflow-engine'
import { memoryService } from './memory-service'
import projectService from './project-service'
import { buildTaskHarness, evaluateHarnessCompletion } from './task-harness'
import {
  decideTaskPipeline,
  formatTaskPipelineNextAction,
  type TaskPipelineClassification,
  type TaskPipelineStation,
} from './task-pipeline'
import { deriveWorkspace, MAIN_WORKSPACE_ID } from './workspace-id'

/** Status values that mean "make this task the active one again". */
const RESUME_VALUES = ['active', 'resume', 'in_progress', 'working']

export interface StartTaskOutcome {
  ok: boolean
  /** Set when a `before_task` gate or hook blocked the start. */
  blocked?: string
  taskId?: string
  description?: string
  branch?: string
  linearId?: string
  linkedSpecId?: string
  harness?: TaskHarness
  pipeline?: {
    classification: TaskPipelineClassification
    station: TaskPipelineStation
    nextAction: string
    requiresSpec: boolean
    requiresTestsFirst: boolean
  }
  /** Agent instructions emitted by `before_task` rules. */
  instructions?: string[]
}

/**
 * Start a task: run before/after workflow rules, persist state, link a spec
 * if requested, and log the `task_started` event. Returns structured data;
 * the caller prints. Mirrors the side-effects of `workflow.now`.
 */
export async function startTask(
  projectId: string,
  projectPath: string,
  description: string,
  options: { skipHooks?: boolean; spec?: string } = {}
): Promise<StartTaskOutcome> {
  // before_task workflow rules (gates may block, hooks may nudge).
  const beforeResult = await executeWorkflowRules(projectId, 'task', 'before', {
    projectPath,
    skipRules: options.skipHooks,
  })
  if (!beforeResult.success) {
    const blocked =
      beforeResult.gatesFailed.length > 0
        ? `Blocked: ${beforeResult.gatesFailed.join(', ')}`
        : `Hook failed: ${beforeResult.hooksFailed.join(', ')}`
    return { ok: false, blocked }
  }

  // SDD strict gate (opt-in via config.sdd.mode === 'strict'): a task must link
  // a REVIEWED spec. Enforced here so `prjct task` and the MCP write-path share
  // it. `off`/`advisory` never block (advisory only nudges via the skill).
  {
    const sddConfig = await configManager.readConfig(projectPath).catch(() => null)
    const { effectiveSddMode } = await import('../commands/sdd')
    if (effectiveSddMode(sddConfig) === 'strict') {
      if (!options.spec) {
        return {
          ok: false,
          blocked:
            'Strict SDD: a spec is required before a task. Run `prjct spec "<title>"`, pass `prjct audit-spec <id>`, then `prjct task --spec <id>`. (Relax with `prjct sdd advisory`.)',
        }
      }
      try {
        const { specService } = await import('./spec-service')
        const spec = await specService.get(projectPath, options.spec)
        if (!spec) {
          return { ok: false, blocked: `Strict SDD: spec ${options.spec} not found.` }
        }
        if (spec.status === 'draft') {
          return {
            ok: false,
            blocked: `Strict SDD: spec "${spec.title}" hasn't passed audit-spec yet (status: draft). Run \`prjct audit-spec ${options.spec}\` first.`,
          }
        }
      } catch {
        // spec lookup failed internally — don't hard-block on our own error
      }
    }
  }

  // Optional Linear issue linkage — matches e.g. `PRJ-42`. Pure tag.
  const linearId = /^[A-Z]+-\d+$/.test(description) ? description : undefined

  const taskId = generateUUID()
  const linkedSpecId = options.spec
  const harness = buildTaskHarness(description)

  // Multi-agent: a task in a child worktree lands in activeTasks[] keyed by
  // its workspaceId, so parallel agents don't clobber a shared currentTask.
  // The main worktree keeps the singular currentTask path (transparent for
  // single-agent use, and the backward-compatible mirror for read paths).
  const ws = await deriveWorkspace(projectPath)
  const workspaceId = ws.isMain ? MAIN_WORKSPACE_ID : ws.workspaceId
  const taskFields = {
    id: taskId,
    description,
    sessionId: generateUUID(),
    linearId,
    linkedSpecId,
    harness,
  }
  if (ws.isMain) {
    await stateStorage.startTask(
      projectId,
      taskFields as Parameters<typeof stateStorage.startTask>[1]
    )
  } else {
    await stateStorage.startTaskInWorkspace(
      projectId,
      {
        ...taskFields,
        branch: ws.branch,
        workspaceId: ws.workspaceId,
        worktreePath: ws.worktreePath,
      } as Parameters<typeof stateStorage.startTaskInWorkspace>[1],
      ws.workspaceId
    )
  }

  const pipelineDecision = decideTaskPipeline(description, linkedSpecId)
  const pipelineState = upsertTaskPipelineState(projectId, {
    taskId,
    workspaceId,
    classification: pipelineDecision.kind,
    station: pipelineDecision.station,
    requiresSpec: pipelineDecision.requiresSpec,
    requiresTestsFirst: pipelineDecision.requiresTestsFirst,
    reason: pipelineDecision.reason,
    linkedSpecId: linkedSpecId ?? null,
  })

  // Mirror the linkage on the spec side so `prjct spec show <id>` lists the
  // linked task. Best-effort — a missing spec just no-ops.
  if (linkedSpecId) {
    try {
      const { specService } = await import('./spec-service')
      await specService.linkTask(projectPath, linkedSpecId, taskId)
    } catch {
      // ignore — task creation already succeeded
    }
  }

  const author = await projectService.ensureAuthor()
  await memoryService.log(
    projectPath,
    'task_started',
    { task: description, taskId, harness, timestamp: dateHelper.getTimestamp() },
    author.name
  )

  await executeWorkflowRules(projectId, 'task', 'after', {
    projectPath,
    skipRules: options.skipHooks,
  })

  const branch = await getGitBranch(projectPath).catch(() => '')

  return {
    ok: true,
    taskId,
    description,
    branch,
    linearId,
    linkedSpecId,
    harness,
    pipeline: {
      classification: pipelineState.classification,
      station: pipelineState.station,
      nextAction: formatTaskPipelineNextAction(pipelineDecision),
      requiresSpec: pipelineState.requiresSpec,
      requiresTestsFirst: pipelineState.requiresTestsFirst,
    },
    instructions: beforeResult.instructions,
  }
}

export type SetStatusOutcome =
  | { ok: true; taskId: string; status: string; verificationWarnings?: string[] }
  /** No active task and no paused task to resume — caller emits the guard. */
  | { ok: false; reason: 'no-active-task' }
  /** The transition isn't supported in this context — caller prints `message`. */
  | { ok: false; reason: 'unsupported'; message: string }

/**
 * Change the active task's status. Drives the real workflow state machine so
 * `state.json` and the audit log agree, after recording the transition. The
 * no-arg / paused-display branches are pure presentation and stay in the CLI
 * command; this owns only the write semantics (value always provided).
 * Mirrors the side-effects of `primitives.status` for the value path.
 */
export async function setTaskStatus(
  projectId: string,
  projectPath: string,
  value: string
): Promise<SetStatusOutcome> {
  const normalized = value.toLowerCase()
  const resumeIntent = RESUME_VALUES.includes(normalized)

  // Multi-agent: in a child worktree the status applies to THAT workspace's
  // task in activeTasks[], isolated from other worktrees. The main worktree
  // keeps the singular currentTask path below.
  const ws = await deriveWorkspace(projectPath)
  if (!ws.isMain) {
    const wsTask = await stateStorage.getCurrentTaskForWorkspace(projectId, ws.workspaceId)
    if (!wsTask) return { ok: false, reason: 'no-active-task' }

    // `done` removes the task from this workspace (-> idle for this worktree),
    // leaving every other workspace's task untouched.
    if (normalized === 'done' || normalized === 'completed') {
      const lastStatus = await readLastStatus(projectId, wsTask.id)
      const verification = await evaluateHarnessCompletion(projectPath, wsTask)
      await memoryService.log(projectPath, STATUS_CHANGE_ACTION, {
        taskId: wsTask.id,
        from: lastStatus ?? null,
        to: value,
        workspaceId: ws.workspaceId,
        harnessWarnings: verification.warnings,
      })
      await stateStorage.completeTaskInWorkspace(projectId, ws.workspaceId)
      return {
        ok: true,
        taskId: wsTask.id,
        status: value,
        verificationWarnings: verification.warnings,
      }
    }

    // Pause/resume PER worktree needs a per-workspace paused store (planned
    // follow-up). Returning an explicit `unsupported` — rather than a false
    // success that mutates nothing — avoids leaving the worktree task wedged
    // in `working` (which would then block the next `prjct task` here).
    return {
      ok: false,
      reason: 'unsupported',
      message: `'${value}' isn't supported for a worktree task yet — only 'done'. (pause/resume per-worktree is a planned follow-up)`,
    }
  }

  // Resume-intent bypasses the active-task guard: when the current task is
  // paused, there's no `currentTask` — promote a paused one first.
  if (resumeIntent) {
    const current = await stateStorage.getCurrentTask(projectId)
    if (!current) {
      const resumed = await stateStorage.resumeTask(projectId)
      if (resumed) {
        await memoryService.log(projectPath, STATUS_CHANGE_ACTION, {
          taskId: resumed.id,
          from: 'paused',
          to: value,
        })
        return { ok: true, taskId: resumed.id, status: value }
      }
    }
  }

  const active = await stateStorage.getCurrentTask(projectId)
  if (!active) return { ok: false, reason: 'no-active-task' }

  const lastStatus = await readLastStatus(projectId, active.id)
  const verification =
    normalized === 'done' || normalized === 'completed'
      ? await evaluateHarnessCompletion(projectPath, active)
      : { warnings: [] }

  await memoryService.log(projectPath, STATUS_CHANGE_ACTION, {
    taskId: active.id,
    from: lastStatus ?? null,
    to: value,
    harnessWarnings: verification.warnings,
  })

  // Drive the real workflow state machine so state.json and the audit log
  // agree. Without this, `status paused` flips the audit trail but leaves
  // state.currentTask.status='in_progress', which later blocks `prjct task`
  // with a bogus "cannot transition from working".
  try {
    if (normalized === 'done' || normalized === 'completed') {
      await stateStorage.completeTask(projectId)
    } else if (normalized === 'paused' || normalized === 'pause') {
      await stateStorage.pauseTask(projectId)
    } else if (resumeIntent) {
      // Only resume if there's no active task; otherwise it's a no-op.
      const current = await stateStorage.getCurrentTask(projectId)
      if (!current) await stateStorage.resumeTask(projectId)
    }
  } catch {
    // State machine rejected a redundant transition (e.g. `done` on an
    // already-completed task). The audit log still captures intent.
  }

  return { ok: true, taskId: active.id, status: value, verificationWarnings: verification.warnings }
}

/**
 * Resolve the active task for the CALLER's worktree — the main worktree's
 * singular currentTask, or the child worktree's slot in activeTasks[]. Returns
 * the full task (incl. linkedSpecId) so callers like `prjct ship` can read its
 * spec linkage and description. Null when this workspace has no active task.
 */
export async function resolveActiveTask(
  projectId: string,
  projectPath: string
): Promise<CurrentTask | null> {
  const ws = await deriveWorkspace(projectPath)
  if (ws.isMain) return stateStorage.getCurrentTask(projectId)
  return stateStorage.getCurrentTaskForWorkspace(projectId, ws.workspaceId)
}

/**
 * Complete the active task for the CALLER's worktree, routing to the singular
 * (main) or per-workspace (child) completion so ship/done isolate correctly.
 * Returns the completed task, or null when nothing was active.
 */
export async function completeActiveTask(
  projectId: string,
  projectPath: string,
  feedback?: TaskFeedback
): Promise<CurrentTask | null> {
  const ws = await deriveWorkspace(projectPath)
  if (ws.isMain) return stateStorage.completeTask(projectId, feedback)
  return stateStorage.completeTaskInWorkspace(projectId, ws.workspaceId, feedback)
}

/**
 * Read the most recent status transition for a task out of the memory event
 * log. Events outlive the task column (which only holds `type`) so we can
 * surface a real status without a schema change. Shared by the CLI's no-arg
 * status display and the status write path.
 */
export async function readLastStatus(projectId: string, taskId: string): Promise<string | null> {
  try {
    const { default: prjctDb } = await import('../storage/database')
    type Row = { data: string }
    const rows = prjctDb.query<Row>(
      projectId,
      'SELECT data FROM events WHERE type = ? ORDER BY id DESC LIMIT 10',
      `memory.${STATUS_CHANGE_ACTION}`
    )
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.data) as { taskId?: string; to?: string }
        if (parsed.taskId === taskId && parsed.to) return parsed.to
      } catch {
        // ignore malformed row
      }
    }
  } catch {
    // non-critical
  }
  return null
}
