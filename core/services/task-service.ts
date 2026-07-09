/**
 * Task service — compatibility backend for `prjct work` and MCP work state.
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

import { REGISTERED_VERBS_SET } from '../commands/verb-names'
import configManager from '../infrastructure/config-manager'
import { STATUS_CHANGE_ACTION } from '../memory/events'
import { deriveTitle as deriveMemTitle, flatDetail, preventiveLabel } from '../memory/format'
import { projectMemory } from '../memory/project-memory'
import { generateUUID } from '../schemas/schemas'
import type { CurrentTask, TaskFeedback, TaskHarness } from '../schemas/state'
import { getGitBranch } from '../session/git-helpers'
import { stateStorage } from '../storage/state-storage'
import { upsertTaskPipelineState } from '../storage/task-pipeline-storage'
import * as dateHelper from '../utils/date-helper'
import { executeWorkflowRules } from '../workflow-engine/workflow-engine'
import { type LikelyFileHit, rankLikelyFiles } from './file-cue'
import { buildLivingContextPrompt, parseLivingContextFields } from './living-context-contract'
import { memoryService } from './memory-service'
import projectService from './project-service'
import { buildTaskHarness, evaluateHarnessCompletion } from './task-harness'
import { type OrchestrationPlan, orchestrationFor } from './task-orchestration'
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
  /** Triage → orchestration plan: model/effort + spec/tests + fan-out directive. */
  orchestration?: OrchestrationPlan
  pipeline?: {
    classification: TaskPipelineClassification
    station: TaskPipelineStation
    nextAction: string
    requiresSpec: boolean
    requiresTestsFirst: boolean
  }
  /** Agent instructions emitted by `before_task` rules. */
  instructions?: string[]
  /**
   * Context recalled from the project's RAG that relates to THIS task's
   * description — past contexts, decisions, traps. The "second brain" answer to
   * "has this happened before? who touched it? what was decided?", surfaced
   * on-demand at task start (PULL, not a session-start dump).
   */
  relatedContext?: RelatedContextHit[]
  /**
   * File targets ranked from the sync-built code indexes for THIS work
   * description. This is the cheap repo map that prevents agents from
   * spending the first minutes rediscovering where existing code lives.
   */
  likelyFiles?: LikelyFileHit[]
  /**
   * PREDICTIVE risk for THIS cycle: preventive memory (gotchas, anti-patterns,
   * recurring-bugs) recorded against the likely files, surfaced at planning so
   * the trap is seen BEFORE the edit instead of stepped in. Reactive guard made
   * proactive — scoped to the area the work will actually touch.
   */
  risks?: RiskHit[]
}

/** One predictive-risk hit — a preventive memory tied to a likely file. */
export interface RiskHit {
  id: string
  label: string
  title: string
  file: string
}

export interface RelatedContextHit {
  id: string
  type: string
  title: string
  detail: string
  /** ISO timestamp the entry was captured. */
  when: string
  author?: string
  keyData?: string
  feature?: string
  files?: string[]
  why?: string
  pattern?: string
  antiPattern?: string
  decisionTrap?: string
  outcome?: string
  nextImplication?: string
}

const RELATED_SALIENT_MAX = 120

/**
 * Compact but self-sufficient one-liner for the passive `work` surface:
 * `[type] title (date) \`id\` — <single most salient field>`.
 *
 * The full body stays one `prjct search <id>` away. We surface only the field
 * most likely to change what the agent does — a trap/decision/anti-pattern
 * outranks generic "why/outcome/key data" — instead of joining every field
 * (which ran ~500 chars/entry). Drops the passive surface to ~100 chars/entry
 * while still carrying the actionable signal.
 */
export function formatRelatedContextForAgent(hit: RelatedContextHit): string {
  const when = hit.when ? hit.when.slice(0, 10) : ''
  const who = hit.author ? ` by ${hit.author}` : ''
  const meta = [when, who].filter(Boolean).join('')
  const head = `[${hit.type}] ${hit.title}${meta ? ` (${meta.trim()})` : ''}  \`${hit.id}\``

  // Priority: what would make me act differently first.
  const salient =
    hit.decisionTrap ?? hit.antiPattern ?? hit.why ?? hit.outcome ?? hit.keyData ?? hit.detail
  if (!salient) return head
  const trimmed =
    salient.length > RELATED_SALIENT_MAX ? `${salient.slice(0, RELATED_SALIENT_MAX - 1)}…` : salient
  return `${head} — ${trimmed}`
}

/**
 * Start a work cycle: run before/after workflow rules, persist state, link a spec
 * if requested, and log the `task_started` event. Returns structured data;
 * the caller prints. Mirrors the side-effects of `workflow.now`.
 */
export async function startTask(
  projectId: string,
  projectPath: string,
  description: string,
  options: {
    skipHooks?: boolean
    spec?: string
    /** Explicit delivery geometry when the working tree is large (strict gate). */
    geometry?: 'direct' | 'single' | 'split'
  } = {}
): Promise<StartTaskOutcome> {
  // Verb-collision guard. Agents on non-Claude harnesses (e.g. Codex) that
  // don't have the verb-intent map memorized tend to wrap a bare CLI verb as
  // a work description — `prjct work "sync"` instead of `prjct sync`. A lone
  // registered verb is never a real work intent, so reject it and point at the
  // command they meant. Multi-word descriptions ("ship the onboarding flow")
  // pass untouched.
  const lone = description.trim().toLowerCase()
  if (REGISTERED_VERBS_SET.has(lone)) {
    return {
      ok: false,
      blocked: `'${lone}' is a prjct command, not a work intent. Did you mean \`prjct ${lone}\`? To start a work cycle, describe the task (e.g. \`prjct work "fix the ${lone} flow"\`).`,
    }
  }

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

  const cfg = await configManager.readConfig(projectPath).catch(() => null)

  // SDD strict gate (opt-in via config.sdd.mode === 'strict'): a work cycle must
  // link a REVIEWED intent/spec. Enforced here so CLI and MCP share
  // it. `off`/`advisory` never block (advisory only nudges via the skill).
  {
    const { effectiveSddMode } = await import('../commands/sdd')
    if (effectiveSddMode(cfg) === 'strict') {
      if (!options.spec) {
        return {
          ok: false,
          blocked:
            'Strict SDD: an intent/spec is required before work. Run `prjct intent "<title>"`, pass `prjct audit-spec <id>`, then `prjct work --spec <id>`. (Relax with `prjct sdd advisory`.)',
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

  // Delivery-geometry gate: large working tree requires an explicit strategy.
  {
    const mode = cfg?.deliveryGeometry?.mode ?? 'off'
    if (mode === 'strict' || mode === 'advisory') {
      try {
        const {
          computeWorkingTreeChangeset,
          geometryOf,
          tierOf,
          geometryBlockMessage,
          NORMAL_MAX_LOC,
        } = await import('./delivery-geometry')
        const threshold = cfg?.deliveryGeometry?.locThreshold ?? NORMAL_MAX_LOC
        const cs = await computeWorkingTreeChangeset(projectPath)
        if (cs && cs.loc >= threshold) {
          const geometry = geometryOf(tierOf(cs))
          if (mode === 'strict' && !options.geometry) {
            return { ok: false, blocked: geometryBlockMessage(cs, geometry) }
          }
        }
      } catch {
        /* geometry is best-effort — never block on git errors */
      }
    }
  }

  // Optional Linear issue linkage — matches e.g. `PRJ-42`. Pure tag.
  const linearId = /^[A-Z]+-\d+$/.test(description) ? description : undefined

  const taskId = generateUUID()
  const linkedSpecId = options.spec
  const harness = buildTaskHarness(description)

  // Triage → orchestration: turn the harness + the project's SDD/TDD modes
  // into a concrete plan (model tier, effort, spec/tests ceremony, fan-out) so
  // a trivial task runs cheap and DIRECT while a complex one gets spec + TDD +
  // a subagent crew — and the agent is told to set each subagent's model (they
  // inherit the parent's expensive model otherwise). This is what makes the
  // classification actually SAVE tokens instead of only gating evidence.
  const orchestration = await (async () => {
    try {
      const cfg = await configManager.readConfig(projectPath).catch(() => null)
      const [{ effectiveSddMode }, { effectiveTddMode }] = await Promise.all([
        import('../commands/sdd'),
        import('../commands/tdd'),
      ])
      return orchestrationFor(harness, effectiveSddMode(cfg), effectiveTddMode(cfg))
    } catch {
      return orchestrationFor(harness)
    }
  })()

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

  // Estimation loop (write side): store the triage's size estimate on the
  // typed row; completion compares it against the ACTUAL diff so velocity can
  // learn the dev's estimation bias per classification. Best-effort.
  try {
    const { prjctDb } = await import('../storage/database')
    prjctDb.run(
      projectId,
      'UPDATE tasks SET expected_value = ? WHERE id = ?',
      String(orchestration.expectedPoints),
      taskId
    )
    // Decomposition record (Task Master's complexity report, written by the
    // triage prjct already runs): score + recommended breakdown, consumed by
    // `prjct expand` and later calibrated against real token telemetry.
    const { workGraph } = await import('./work-graph')
    workGraph.recordComplexity(projectId, taskId, {
      score: orchestration.expectedPoints,
      recommendedSubtasks:
        orchestration.expectedPoints >= 5 ? Math.min(orchestration.expectedPoints, 6) : 0,
      reasoning: `Triage: ${harness.level} · ${orchestration.model}/${orchestration.effort} · fan-out ${orchestration.fanout}`,
    })
  } catch {
    /* estimate is advisory telemetry */
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

  // The superpower: recall what the project already knows about THIS task —
  // past contexts/decisions/traps related to the description — so the agent
  // gets "has this happened before? who? what was decided?" up front, pulled
  // on demand. Reuses the one RAG pipeline (enrichedRecall) so it works over
  // the user's EXISTING memory from day one. Best-effort; never blocks a start.
  const relatedContext = await recallRelatedContext(projectPath, projectId, description)
  const likelyFiles = recallLikelyFiles(projectId, description)
  // Predictive risk: concentrate the preventive memory for the area this cycle
  // will touch, so the trap is surfaced at planning, not after it bites.
  const risks = recallRisksForFiles(projectId, likelyFiles)

  return {
    ok: true,
    taskId,
    description,
    branch,
    linearId,
    linkedSpecId,
    harness,
    orchestration,
    pipeline: {
      classification: pipelineState.classification,
      station: pipelineState.station,
      nextAction: formatTaskPipelineNextAction(pipelineDecision),
      requiresSpec: pipelineState.requiresSpec,
      requiresTestsFirst: pipelineState.requiresTestsFirst,
    },
    instructions: beforeResult.instructions,
    relatedContext,
    likelyFiles,
    risks,
  }
}

/**
 * Predictive risk briefing: for the cycle's likely files, recall ONLY preventive
 * memory (gotchas, anti-patterns, recurring-bugs) and dedup to a tight set. This
 * is `prjct guard` run automatically over the area the work will touch — risk
 * seen before the edit, not after. Best-effort; never blocks a start.
 */
export function recallRisksForFiles(projectId: string, files: LikelyFileHit[]): RiskHit[] {
  const seen = new Set<string>()
  const risks: RiskHit[] = []
  try {
    for (const f of files.slice(0, 5)) {
      const hits = projectMemory.recallForFile(projectId, f.path, 2, { preventiveOnly: true })
      for (const h of hits) {
        if (seen.has(h.id)) continue
        seen.add(h.id)
        risks.push({ id: h.id, label: preventiveLabel(h), title: deriveMemTitle(h), file: f.path })
        if (risks.length >= 4) return risks
      }
    }
  } catch {
    /* best-effort — risk briefing never blocks a start */
  }
  return risks
}

/** Pull likely file targets from prebuilt indexes (best-effort, no live scan). */
function recallLikelyFiles(projectId: string, description: string): LikelyFileHit[] {
  try {
    return rankLikelyFiles(projectId, description)
  } catch {
    return []
  }
}

/** Pull the RAG for context related to a task description (best-effort). */
async function recallRelatedContext(
  projectPath: string,
  projectId: string,
  description: string
): Promise<RelatedContextHit[]> {
  try {
    const { enrichedRecall } = await import('../memory/enriched-recall')
    const { deriveTitle } = await import('../memory/format')
    const hits = await enrichedRecall(projectPath, projectId, {
      topic: description,
      types: ['context', 'decision', 'gotcha', 'anti-pattern'],
      limit: 5,
    })
    if (hits.length === 0) return []
    // Learn which surfaced context proves useful (usefulness ledger).
    const { recordSurfacedForActiveTask } = await import('./usefulness/surface-attribution')
    await recordSurfacedForActiveTask(
      projectId,
      projectPath,
      hits.map((h) => h.id)
    )
    return hits.map((h) => {
      const fields = parseLivingContextFields(h.content)
      const files =
        fields.relatedFiles ??
        h.tags?.related_files?.split(',').filter(Boolean) ??
        h.tags?.files?.split(',').filter(Boolean)
      return {
        id: h.id,
        type: h.type,
        title: deriveTitle(h),
        detail: fields.contextSynthesis ?? flatDetail(h.content, 180),
        when: h.rememberedAt,
        author: fields.whoAuthor ?? h.tags?.author,
        keyData: fields.keyData ?? h.tags?.key_data,
        feature: fields.featureDomain ?? h.tags?.feature,
        files,
        why: fields.whyItMattered,
        pattern: fields.pattern,
        antiPattern: fields.antiPattern,
        decisionTrap: fields.decisionTrap,
        outcome: fields.outcome,
        nextImplication: fields.nextImplication,
      }
    })
  } catch {
    return []
  }
}

/**
 * The in-band directive emitted when a task closes: the agent (who just did the
 * work and understands the sentiment) writes the task's CONTEXT — the per-task
 * unit of the project's second-brain RAG. English, structured, not a raw quote.
 */
export const TASK_CONTEXT_PROMPT = buildLivingContextPrompt()

export type SetStatusOutcome =
  | {
      ok: true
      taskId: string
      status: string
      verificationWarnings?: string[]
      /** Present when the task just closed (`done`): instruct the agent to
       *  write the task context. */
      contextPrompt?: string
    }
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
      await recordEstimationOutcome(projectId, wsTask.id, verification.diffSize)
      try {
        const { usefulnessService } = await import('./usefulness')
        usefulnessService.creditShippedTask(projectId, wsTask.id)
      } catch {
        /* best-effort usefulness credit */
      }
      return {
        ok: true,
        taskId: wsTask.id,
        status: value,
        verificationWarnings: verification.warnings,
        contextPrompt: TASK_CONTEXT_PROMPT,
      }
    }

    // Pause/resume PER worktree needs a per-workspace paused store (planned
    // follow-up). Returning an explicit `unsupported` — rather than a false
    // success that mutates nothing — avoids leaving the worktree task wedged
    // in `working` (which would then block the next `prjct work` here).
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
      : { warnings: [], diffSize: 0 }

  await memoryService.log(projectPath, STATUS_CHANGE_ACTION, {
    taskId: active.id,
    from: lastStatus ?? null,
    to: value,
    harnessWarnings: verification.warnings,
  })

  // Drive the real workflow state machine so state.json and the audit log
  // agree. Without this, `status paused` flips the audit trail but leaves
  // state.currentTask.status='in_progress', which later blocks `prjct work`
  // with a bogus "cannot transition from working".
  try {
    if (normalized === 'done' || normalized === 'completed') {
      await stateStorage.completeTask(projectId)
      await recordEstimationOutcome(projectId, active.id, verification.diffSize)
      try {
        const { usefulnessService } = await import('./usefulness')
        usefulnessService.creditShippedTask(projectId, active.id)
      } catch {
        /* best-effort usefulness credit */
      }
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

  return {
    ok: true,
    taskId: active.id,
    status: value,
    verificationWarnings: verification.warnings,
    contextPrompt:
      normalized === 'done' || normalized === 'completed' ? TASK_CONTEXT_PROMPT : undefined,
  }
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
/**
 * Estimation loop (close side): fold expected vs ACTUAL size into the
 * completed task's cold data. Runs AFTER the state-storage completion (whose
 * history mirror rewrites `data`), so json_set survives. Best-effort.
 */
async function recordEstimationOutcome(
  projectId: string,
  taskId: string,
  diffSize: number
): Promise<void> {
  try {
    const { prjctDb } = await import('../storage/database')
    const { pointsFromDiffLines } = await import('./task-orchestration')
    const row = prjctDb.get<{ expected_value: string | null }>(
      projectId,
      'SELECT expected_value FROM tasks WHERE id = ?',
      taskId
    )
    const expected = Number(row?.expected_value)
    if (!Number.isFinite(expected) || expected <= 0) return
    prjctDb.run(
      projectId,
      `UPDATE tasks SET data = json_set(COALESCE(data, '{}'),
         '$.expectedPoints', ?, '$.actualPoints', ?, '$.diffLines', ?)
       WHERE id = ?`,
      expected,
      pointsFromDiffLines(diffSize),
      diffSize,
      taskId
    )
  } catch {
    /* estimation telemetry only */
  }
}

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
