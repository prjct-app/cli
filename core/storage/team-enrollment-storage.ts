/**
 * Team Enrollment Storage
 *
 * Single kv_store row at key `team:enrollment` per project. Source of
 * truth for `prjct team` enrollment state — `prjct team` writes here
 * first, then regenerates `.prjct/team.json` from the row as a derived
 * disk mirror (the pre-commit hook reads the mirror because it must
 * work BEFORE prjct is installed on a new contributor's machine).
 *
 * See spec a50b32d1 AC #1.
 */

import { z } from 'zod'
import prjctDb from './database'

export const TEAM_ENROLLMENT_KEY = 'team:enrollment'

export const TeamEnrollmentSchema = z.object({
  required: z.boolean(),
  minVersion: z.string().min(1),
  enrolledAt: z.string().min(1),
  /** Identifies the user / mechanism that enrolled the repo. Optional. */
  enrolledBy: z.string().nullable().default(null),
})

export type TeamEnrollment = z.infer<typeof TeamEnrollmentSchema>

class TeamEnrollmentStorage {
  get(projectId: string): TeamEnrollment | null {
    const raw = prjctDb.getDoc<unknown>(projectId, TEAM_ENROLLMENT_KEY)
    if (raw === null) return null
    return TeamEnrollmentSchema.parse(raw)
  }

  set(projectId: string, enrollment: TeamEnrollment): void {
    const validated = TeamEnrollmentSchema.parse(enrollment)
    prjctDb.setDoc(projectId, TEAM_ENROLLMENT_KEY, validated)
  }

  clear(projectId: string): void {
    prjctDb.deleteDoc(projectId, TEAM_ENROLLMENT_KEY)
  }
}

/**
 * Canonical JSON serializer for byte-equality comparison between the
 * DB row and the on-disk mirror. Sorted keys, no whitespace beyond
 * what JSON.stringify produces. Used by `prjct team check`.
 */
export function serializeCanonical(enrollment: TeamEnrollment): string {
  const sortedKeys = Object.keys(enrollment).sort() as Array<keyof TeamEnrollment>
  const ordered: Record<string, unknown> = {}
  for (const k of sortedKeys) ordered[k] = enrollment[k]
  return JSON.stringify(ordered)
}

export const teamEnrollmentStorage = new TeamEnrollmentStorage()
export default teamEnrollmentStorage
