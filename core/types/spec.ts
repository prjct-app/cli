/**
 * Spec — first-class SDD entity.
 *
 * A spec frames a piece of work BEFORE implementation: goal, eli10,
 * acceptance criteria, scope, out-of-scope, risks, test plan. Stored
 * as a row in the `specs` table (migration 16); the structured content
 * lives in the `content` column as JSON validated by `SpecContentSchema`.
 *
 * Lifecycle:
 *   draft → reviewed → in_progress → shipped
 *                                  → archived
 *
 * `prjct task --spec <id>` links a task to its spec via tasks.linked_spec_id.
 * `prjct ship` reads the linked spec's acceptance_criteria as a gate.
 * `prjct audit-spec <id>` populates `reviews` after dispatching subagents.
 */

import { z } from 'zod'

export const SPEC_STATUSES = ['draft', 'reviewed', 'in_progress', 'shipped', 'archived'] as const
export type SpecStatus = (typeof SPEC_STATUSES)[number]

export const SPEC_REVIEWERS = ['strategic', 'architecture', 'design'] as const
export type SpecReviewer = (typeof SPEC_REVIEWERS)[number]

const SpecReviewSchema = z.object({
  verdict: z.enum(['pass', 'fail']),
  notes: z.string(),
  ts: z.string(),
})
export type SpecReview = z.infer<typeof SpecReviewSchema>

const SpecRiskSchema = z.object({
  risk: z.string().min(1),
  mitigation: z.string().min(1),
})
export type SpecRisk = z.infer<typeof SpecRiskSchema>

export const SpecContentSchema = z.object({
  goal: z.string().min(1),
  eli10: z.string().default(''),
  stakes: z.string().default(''),
  acceptance_criteria: z.array(z.string().min(1)).default([]),
  scope: z.array(z.string()).default([]),
  out_of_scope: z.array(z.string()).default([]),
  risks: z.array(SpecRiskSchema).default([]),
  test_plan: z.array(z.string()).default([]),
  reviews: z
    .object({
      strategic: SpecReviewSchema.optional(),
      architecture: SpecReviewSchema.optional(),
      design: SpecReviewSchema.optional(),
    })
    .optional(),
  linked_tasks: z.array(z.string()).default([]),
  notes: z.string().default(''),
})

export type SpecContent = z.infer<typeof SpecContentSchema>

export interface Spec {
  id: string
  title: string
  status: SpecStatus
  content: SpecContent
  tags: Record<string, string>
  createdAt: string
  updatedAt: string
  shippedAt: string | null
  shippedPr: number | null
  archivedAt: string | null
}

/**
 * Empty spec content — the seed for new specs before the user / Claude
 * fills in the structured fields. `goal` MUST be provided by the caller
 * (the title alone isn't enough — a spec without a goal is just a TODO).
 */
export function emptySpecContent(goal: string): SpecContent {
  return SpecContentSchema.parse({ goal })
}
