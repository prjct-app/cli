/**
 * Crew Run Storage
 *
 * One kv_store row per crew session: key `crew-run:<run-id>`, value is
 * the structured record below. Source-of-truth for what implementer +
 * reviewer produced in a single crew flow; vault regen renders each
 * row to `~/Documents/prjct/<slug>/_generated/crew-runs/...`.
 *
 * NOT a `prjct remember` entry — keeps the memory taxonomy clean of
 * ephemeral per-role scratch. See spec a50b32d1 AC #3.
 */

import { z } from 'zod'
import { generateUUID } from '../schemas/schemas'
import { getTimestamp } from '../utils/date-helper'
import prjctDb from './database'

export const CREW_RUN_KEY_PREFIX = 'crew-run:'

export const CrewRunSchema = z.object({
  id: z.string().min(1),
  spec_id: z.string().nullable().default(null),
  task_id: z.string().nullable().default(null),
  started_at: z.string().min(1),
  ended_at: z.string().min(1),
  implementer_summary: z.string().default(''),
  files_touched: z.array(z.string()).default([]),
  reviewer_verdict: z.enum(['APPROVED', 'CHANGES_REQUESTED']),
  reviewer_notes: z.string().nullable().default(null),
})

export type CrewRun = z.infer<typeof CrewRunSchema>

export interface RecordCrewRunInput {
  /** Caller-supplied run-id for idempotent retry. Generated if omitted. */
  runId?: string
  specId?: string | null
  taskId?: string | null
  implementerSummary: string
  filesTouched: string[]
  reviewerVerdict: 'APPROVED' | 'CHANGES_REQUESTED'
  reviewerNotes?: string | null
  startedAt?: string
  endedAt?: string
}

function keyFor(runId: string): string {
  return `${CREW_RUN_KEY_PREFIX}${runId}`
}

class CrewRunStorage {
  /**
   * Idempotent on `runId`: re-invoking with the same id returns the
   * existing row unchanged (no clobbering of started_at, no duplicate
   * vault page). Generated UUID is returned in the `id` field when the
   * caller doesn't supply one.
   */
  record(projectId: string, input: RecordCrewRunInput): CrewRun {
    const runId = input.runId ?? generateUUID()
    const existing = prjctDb.getDoc<CrewRun>(projectId, keyFor(runId))
    if (existing) return existing

    const now = getTimestamp()
    const run = CrewRunSchema.parse({
      id: runId,
      spec_id: input.specId ?? null,
      task_id: input.taskId ?? null,
      started_at: input.startedAt ?? now,
      ended_at: input.endedAt ?? now,
      implementer_summary: input.implementerSummary,
      files_touched: input.filesTouched,
      reviewer_verdict: input.reviewerVerdict,
      reviewer_notes: input.reviewerNotes ?? null,
    })
    prjctDb.setDoc(projectId, keyFor(runId), run)
    return run
  }

  get(projectId: string, runId: string): CrewRun | null {
    return prjctDb.getDoc<CrewRun>(projectId, keyFor(runId))
  }

  list(projectId: string): CrewRun[] {
    const rows = prjctDb.listDocsByPrefix<CrewRun>(projectId, CREW_RUN_KEY_PREFIX)
    return rows.map((r) => CrewRunSchema.parse(r.data))
  }

  delete(projectId: string, runId: string): void {
    prjctDb.deleteDoc(projectId, keyFor(runId))
  }
}

export const crewRunStorage = new CrewRunStorage()
export default crewRunStorage
