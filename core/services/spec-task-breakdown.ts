/**
 * Spec → Tasks auto-breakdown.
 *
 * When `audit-spec` promotes a spec from `draft` → `reviewed` (all three
 * reviewers pass), the spec's `acceptance_criteria` are materialized as
 * granular queue tasks — one per AC. Each task lands in the backlog
 * tagged with `featureId = spec.id` so the user can pick them up via
 * `prjct task` and the vault renders them as individual rows instead of
 * a single monolithic spec document.
 *
 * Idempotent: if the spec already has linked_tasks, breakdown is a no-op.
 * That covers the re-audit path (a fail → pass cycle re-enters this code
 * but must not double-create tasks).
 */
import { projectMemory } from '../memory/project-memory'
import { queueStorage } from '../storage/queue-storage'
import { specStorage } from '../storage/spec-storage'
import type { Spec } from '../types/spec'

export interface BreakdownResult {
  /** Task ids newly created. Empty when breakdown is a no-op. */
  taskIds: string[]
  /** Why we skipped (only present when taskIds is empty). */
  skippedReason?: 'no_acceptance_criteria' | 'already_broken_down'
}

/**
 * Materialize `spec.content.acceptance_criteria` as queue tasks.
 *
 * One AC → one queue task. The task's `description` is the AC text
 * (truncated to ~140 chars for readability); the full AC lands in `body`
 * unchanged. Tasks go to `backlog` so they don't auto-activate — the
 * user picks them up explicitly.
 */
export async function breakdownSpecToTasks(
  projectId: string,
  projectPath: string,
  spec: Spec
): Promise<BreakdownResult> {
  const acs = spec.content.acceptance_criteria
  if (acs.length === 0) {
    return { taskIds: [], skippedReason: 'no_acceptance_criteria' }
  }
  if (spec.content.linked_tasks.length > 0) {
    return { taskIds: [], skippedReason: 'already_broken_down' }
  }

  const newTasks = await queueStorage.addTasks(
    projectId,
    acs.map((ac) => ({
      description: truncateForDescription(ac),
      body: ac,
      priority: 'medium' as const,
      type: 'feature' as const,
      section: 'backlog' as const,
      featureId: spec.id,
      groupId: spec.id,
      groupName: spec.title,
    }))
  )

  // Persist the link both directions so spec.content.linked_tasks reflects
  // the new task ids and the vault renders them under "Linked tasks".
  for (const task of newTasks) {
    specStorage.linkTask(projectId, spec.id, task.id)
  }

  // Mirror to memory event stream so `prjct context memory spec` and the
  // user's session both surface the breakdown event.
  await projectMemory.remember(projectPath, {
    type: 'spec',
    content: `Auto-breakdown: ${newTasks.length} tasks created from ${spec.title}`,
    tags: {
      spec_id: spec.id,
      event: 'auto_breakdown',
      task_count: String(newTasks.length),
    },
    source: spec.id,
  })

  return { taskIds: newTasks.map((t) => t.id) }
}

/**
 * Acceptance criteria are often long sentences with rationale; the queue
 * description is meant to be glanceable. Cap at ~140 chars and append an
 * ellipsis so the user knows there's more in the body.
 */
function truncateForDescription(ac: string): string {
  const oneLine = ac.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= 140) return oneLine
  return `${oneLine.slice(0, 137)}…`
}
