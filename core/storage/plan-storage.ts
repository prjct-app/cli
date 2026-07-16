/**
 * Active work-plan storage (plan-mode ceremony).
 *
 * One kv_store row per project at key `work-plan:active`. Status draft means
 * the host agent should treat the workspace as read-only except for plan
 * updates via `prjct plan write`. Approve clears the hard contract and
 * persists a decision memory (caller).
 */

import { z } from 'zod'
import { getTimestamp } from '../utils/date-helper'
import prjctDb from './database'

export const PLAN_KEY = 'work-plan:active'

export const WorkPlanSchema = z.object({
  status: z.enum(['draft', 'approved', 'abandoned']),
  title: z.string().min(1),
  content: z.string(),
  taskId: z.string().nullable().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  approvedAt: z.string().nullable().optional(),
})

export type WorkPlan = z.infer<typeof WorkPlanSchema>

/** Canonical plan skeleton (Grok plan-mode sections). */
export function emptyPlanTemplate(title: string): string {
  return [
    `# Plan: ${title}`,
    '',
    '## Context',
    '',
    'Why this change is needed.',
    '',
    '## Recommended approach',
    '',
    'The path we will take (not every alternative).',
    '',
    '## Critical files',
    '',
    '- `path/to/file` — why',
    '',
    '## Reuse',
    '',
    'Existing functions/utilities to match (file:line when known).',
    '',
    '## Verification',
    '',
    'How to test end-to-end after implementation.',
    '',
  ].join('\n')
}

class PlanStorage {
  get(projectId: string): WorkPlan | null {
    const raw = prjctDb.getDoc<unknown>(projectId, PLAN_KEY)
    if (raw === null) return null
    const parsed = WorkPlanSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  }

  set(projectId: string, plan: WorkPlan): WorkPlan {
    const row = WorkPlanSchema.parse(plan)
    prjctDb.setDoc(projectId, PLAN_KEY, row)
    return row
  }

  start(projectId: string, title: string, taskId?: string | null): WorkPlan {
    const now = getTimestamp()
    const plan: WorkPlan = {
      status: 'draft',
      title: title.trim() || 'Untitled plan',
      content: emptyPlanTemplate(title.trim() || 'Untitled plan'),
      taskId: taskId ?? null,
      createdAt: now,
      updatedAt: now,
      approvedAt: null,
    }
    return this.set(projectId, plan)
  }

  writeContent(projectId: string, content: string): WorkPlan | null {
    const cur = this.get(projectId)
    if (!cur || cur.status !== 'draft') return null
    return this.set(projectId, {
      ...cur,
      content,
      updatedAt: getTimestamp(),
    })
  }

  approve(projectId: string): WorkPlan | null {
    const cur = this.get(projectId)
    if (!cur || cur.status !== 'draft') return null
    const now = getTimestamp()
    return this.set(projectId, {
      ...cur,
      status: 'approved',
      updatedAt: now,
      approvedAt: now,
    })
  }

  abandon(projectId: string): WorkPlan | null {
    const cur = this.get(projectId)
    if (!cur) return null
    return this.set(projectId, {
      ...cur,
      status: 'abandoned',
      updatedAt: getTimestamp(),
    })
  }

  clear(projectId: string): void {
    prjctDb.deleteDoc(projectId, PLAN_KEY)
  }
}

export const planStorage = new PlanStorage()
