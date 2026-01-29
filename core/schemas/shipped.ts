/**
 * Shipped Schema
 *
 * Defines the structure for shipped.json - completed/shipped items.
 * Uses Zod for runtime validation and TypeScript type inference.
 * ZERO DATA LOSS - captures ALL fields from MD files.
 *
 * @version 2.0.0
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas - Source of Truth
// =============================================================================

export const ShipTypeSchema = z.enum(['feature', 'fix', 'improvement', 'refactor'])
export const CheckStatusSchema = z.enum(['pass', 'warning', 'fail', 'skipped'])
export const ChangeTypeSchema = z.enum(['added', 'changed', 'fixed', 'removed'])

export const DurationSchema = z.object({
  hours: z.number(),
  minutes: z.number(),
  totalMinutes: z.number(),
})

export const CodeMetricsSchema = z.object({
  filesChanged: z.number().nullable().optional(),
  linesAdded: z.number().nullable().optional(),
  linesRemoved: z.number().nullable().optional(),
  commits: z.number().nullable().optional(),
})

export const ShipChangeSchema = z.object({
  description: z.string(),
  type: ChangeTypeSchema.optional(),
})

export const QualityMetricsSchema = z.object({
  lintStatus: CheckStatusSchema.nullable().optional(),
  lintDetails: z.string().optional(),
  testStatus: CheckStatusSchema.nullable().optional(),
  testDetails: z.string().optional(),
})

export const CommitInfoSchema = z.object({
  hash: z.string().optional(),
  message: z.string().optional(),
  branch: z.string().optional(),
})

export const ShippedItemSchema = z.object({
  id: z.string(), // ship_xxxxxxxx
  name: z.string(),
  version: z.string().nullable().optional(),
  type: ShipTypeSchema,
  agent: z.string().optional(), // "fe+be", "be", "fe"
  description: z.string().optional(),
  changes: z.array(ShipChangeSchema),
  codeSnippets: z.array(z.string()).optional(),
  commit: CommitInfoSchema.optional(),
  codeMetrics: CodeMetricsSchema.optional(),
  qualityMetrics: QualityMetricsSchema.optional(),
  quantitativeImpact: z.string().optional(),
  duration: DurationSchema.optional(),
  tasksCompleted: z.number().nullable().optional(),
  shippedAt: z.string(), // ISO8601
  featureId: z.string().optional(),
})

export const ShippedJsonSchema = z.object({
  items: z.array(ShippedItemSchema),
  lastUpdated: z.string(),
})

// =============================================================================
// Inferred Types - Backward Compatible
// =============================================================================

export type ShipType = z.infer<typeof ShipTypeSchema>
export type CheckStatus = z.infer<typeof CheckStatusSchema>
export type AgentType = 'fe' | 'be' | 'fe+be' | 'devops' | 'ai' | string
export type Duration = z.infer<typeof DurationSchema>
export type CodeMetrics = z.infer<typeof CodeMetricsSchema>
export type ShipChange = z.infer<typeof ShipChangeSchema>
export type QualityMetrics = z.infer<typeof QualityMetricsSchema>
export type CommitInfo = z.infer<typeof CommitInfoSchema>
export type ShippedItemSchema = z.infer<typeof ShippedItemSchema>
export type ShippedJson = z.infer<typeof ShippedJsonSchema>

// Legacy type for backwards compatibility
export type ShippedSchema = ShippedItemSchema[]

// =============================================================================
// Validation Helpers
// =============================================================================

/** Parse and validate shipped.json content */
export const parseShipped = (data: unknown): ShippedJson => ShippedJsonSchema.parse(data)
export const safeParseShipped = (data: unknown) => ShippedJsonSchema.safeParse(data)

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_SHIPPED: ShippedJson = {
  items: [],
  lastUpdated: '',
}
