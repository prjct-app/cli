/**
 * Session Snapshot Schema (PRJ-285)
 *
 * Defines the structure for session snapshots that preserve context
 * across project switches and terminal sessions.
 *
 * Stored in each project's SQLite kv_store with key 'session-snapshot'.
 */

import { z } from 'zod'

export const SessionSnapshotSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  projectPath: z.string(),
  projectName: z.string().optional(),
  taskDescription: z.string(),
  taskStatus: z.enum(['active', 'paused']),
  activeSubtaskIndex: z.number().optional(),
  subtaskCount: z.number().optional(),
  branch: z.string().optional(),
  linearId: z.string().optional(),
  filesModified: z.array(z.string()).optional(),
  durationWorkedSec: z.number().optional(),
  timestamp: z.string(),
  resumeHint: z.string(),
})

export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>
