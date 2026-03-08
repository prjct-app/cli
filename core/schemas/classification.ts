/**
 * Task Classification Schema
 *
 * Defines the structure for LLM-based domain classification results.
 * Domains are free-form strings — the LLM decides domain names.
 *
 * @see PRJ-299
 */

import { z } from 'zod'

// =============================================================================
// Classification Schemas
// =============================================================================

export const ClassificationDomainSchema = z.string()

export const TaskClassificationSchema = z.object({
  /** Primary domain for this task */
  primaryDomain: ClassificationDomainSchema,
  /** Secondary domains that are also relevant */
  secondaryDomains: z.array(ClassificationDomainSchema),
  /** Confidence in the classification (0-1) */
  confidence: z.number().min(0).max(1),
  /** Glob patterns for relevant files */
  filePatterns: z.array(z.string()),
  /** Agent names that should handle this task */
  relevantAgents: z.array(z.string()),
})

export const ClassificationCacheEntrySchema = z.object({
  /** The classification result */
  classification: TaskClassificationSchema,
  /** When this was classified */
  classifiedAt: z.string(),
  /** How this was classified */
  source: z.enum(['cache', 'history', 'llm', 'heuristic']),
  /** Hash of the task description for cache lookup */
  descriptionHash: z.string(),
  /** Project ID this classification belongs to */
  projectId: z.string(),
})

export const ClassificationCacheSchema = z.object({
  /** Cached classifications keyed by descriptionHash */
  entries: z.record(z.string(), ClassificationCacheEntrySchema),
  /** Confirmed patterns from successful task completions */
  confirmedPatterns: z.array(
    z.object({
      descriptionHash: z.string(),
      classification: TaskClassificationSchema,
      confirmedAt: z.string(),
      taskDescription: z.string(),
    })
  ),
})

// =============================================================================
// Inferred Types
// =============================================================================

export type ClassificationDomain = z.infer<typeof ClassificationDomainSchema>
export type TaskClassification = z.infer<typeof TaskClassificationSchema>
export type ClassificationCacheEntry = z.infer<typeof ClassificationCacheEntrySchema>
export type ClassificationCache = z.infer<typeof ClassificationCacheSchema>

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_CLASSIFICATION_CACHE: ClassificationCache = {
  entries: {},
  confirmedPatterns: [],
}

export const GENERAL_CLASSIFICATION: TaskClassification = {
  primaryDomain: 'general',
  secondaryDomains: [],
  confidence: 0.3,
  filePatterns: ['**/*.ts', '**/*.js'],
  relevantAgents: [],
}
