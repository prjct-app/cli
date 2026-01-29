/**
 * Issues Schema
 *
 * Defines the structure for issues.json - local cache of issue tracker issues.
 * Used for bidirectional sync with Linear/JIRA/etc.
 *
 * Location: ~/.prjct-cli/projects/{projectId}/storage/issues.json
 */

import { z } from 'zod'

// =============================================================================
// Issue Provider Types
// =============================================================================

export const IssueProviderSchema = z.enum(['linear', 'jira', 'github', 'monday', 'asana', 'none'])
export const IssueStatusSchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
])
export const IssuePrioritySchema = z.enum(['none', 'urgent', 'high', 'medium', 'low'])
export const IssueTypeSchema = z.enum(['feature', 'bug', 'improvement', 'task', 'chore', 'epic'])

// =============================================================================
// Cached Issue Schema
// =============================================================================

/**
 * Single cached issue from provider
 */
export const CachedIssueSchema = z.object({
  // Core identifiers
  id: z.string(), // Provider UUID
  identifier: z.string(), // Human-readable ID (e.g., "PRJ-123")

  // Issue content
  title: z.string(),
  description: z.string().optional(),

  // State
  status: IssueStatusSchema,
  priority: IssuePrioritySchema,
  type: IssueTypeSchema.optional(),

  // Metadata
  assignee: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string().optional(),
    })
    .optional(),
  labels: z.array(z.string()).default([]),
  team: z
    .object({
      id: z.string(),
      name: z.string(),
      key: z.string().optional(),
    })
    .optional(),
  project: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),

  // URLs and timestamps
  url: z.string(),
  createdAt: z.string(), // ISO8601 from provider
  updatedAt: z.string(), // ISO8601 from provider
  fetchedAt: z.string(), // ISO8601 when we cached it
})

// =============================================================================
// Issues JSON Schema (Root)
// =============================================================================

/**
 * Root schema for issues.json
 * Maps identifier -> CachedIssue for quick lookup
 */
export const IssuesJsonSchema = z.object({
  // Provider info
  provider: IssueProviderSchema,

  // Sync metadata
  lastSync: z.string(), // ISO8601 of last full sync
  staleAfter: z.number().default(1800000), // 30 minutes in ms

  // Issues map: identifier -> issue
  issues: z.record(z.string(), CachedIssueSchema),
})

// =============================================================================
// Sync Result Schema
// =============================================================================

export const SyncResultSchema = z.object({
  provider: IssueProviderSchema,
  fetched: z.number(),
  updated: z.number(),
  errors: z.array(
    z.object({
      issueId: z.string(),
      error: z.string(),
    })
  ),
  timestamp: z.string(),
})

// =============================================================================
// Inferred Types
// =============================================================================

export type IssueProvider = z.infer<typeof IssueProviderSchema>
export type IssueStatus = z.infer<typeof IssueStatusSchema>
export type IssuePriority = z.infer<typeof IssuePrioritySchema>
export type IssueType = z.infer<typeof IssueTypeSchema>
export type CachedIssue = z.infer<typeof CachedIssueSchema>
export type IssuesJson = z.infer<typeof IssuesJsonSchema>
export type SyncResult = z.infer<typeof SyncResultSchema>

// =============================================================================
// Validation Helpers
// =============================================================================

/** Parse and validate issues.json content */
export const parseIssues = (data: unknown): IssuesJson => IssuesJsonSchema.parse(data)

/** Safe parse with error result */
export const safeParseIssues = (data: unknown) => IssuesJsonSchema.safeParse(data)

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_ISSUES: IssuesJson = {
  provider: 'none',
  lastSync: '',
  staleAfter: 1800000, // 30 minutes
  issues: {},
}

/**
 * Create empty issues.json for a provider
 */
export function createEmptyIssues(provider: IssueProvider): IssuesJson {
  return {
    provider,
    lastSync: '',
    staleAfter: 1800000,
    issues: {},
  }
}
