/**
 * Project Schema
 *
 * Defines the structure for project.json - project metadata.
 * Uses Zod for runtime validation and TypeScript type inference.
 *
 * @version 2.0.0
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas - Source of Truth
// =============================================================================

export const ProjectItemSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  repoPath: z.string(),
  description: z.string().optional(),
  version: z.string().optional(),
  cliVersion: z.string().optional(), // prjct-cli version used to sync
  techStack: z.array(z.string()),
  fileCount: z.number(),
  commitCount: z.number(),
  createdAt: z.string(), // ISO8601
  lastSync: z.string(), // ISO8601
})

// =============================================================================
// Inferred Types - Backward Compatible
// =============================================================================

export type ProjectSchema = z.infer<typeof ProjectItemSchema>

// =============================================================================
// Validation Helpers
// =============================================================================

/** Parse and validate project.json content */
export const parseProject = (data: unknown): ProjectSchema => ProjectItemSchema.parse(data)
export const safeParseProject = (data: unknown) => ProjectItemSchema.safeParse(data)

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_PROJECT: Omit<ProjectSchema, 'projectId' | 'name' | 'repoPath'> = {
  techStack: [],
  fileCount: 0,
  commitCount: 0,
  createdAt: new Date().toISOString(),
  lastSync: new Date().toISOString(),
}
