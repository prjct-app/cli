/**
 * Shipped Schema
 *
 * Defines the structure for shipped data — completed/shipped items.
 * Uses Zod for runtime validation and TypeScript type inference.
 *
 * Public surface: `ShippedJsonSchema` (the root schema) and `ShippedJson`
 * (the inferred type). All inner schemas are internal building blocks.
 */

import { z } from 'zod'

const ShipTypeSchema = z.enum(['feature', 'fix', 'improvement', 'refactor'])
const CheckStatusSchema = z.enum(['pass', 'warning', 'fail', 'skipped'])
const ChangeTypeSchema = z.enum(['added', 'changed', 'fixed', 'removed'])

const DurationSchema = z.object({
  hours: z.number(),
  minutes: z.number(),
  totalMinutes: z.number(),
})

const CodeMetricsSchema = z.object({
  filesChanged: z.number().nullable().optional(),
  linesAdded: z.number().nullable().optional(),
  linesRemoved: z.number().nullable().optional(),
  commits: z.number().nullable().optional(),
})

const ShipChangeSchema = z.object({
  description: z.string(),
  type: ChangeTypeSchema.optional(),
})

const QualityMetricsSchema = z.object({
  lintStatus: CheckStatusSchema.nullable().optional(),
  lintDetails: z.string().optional(),
  testStatus: CheckStatusSchema.nullable().optional(),
  testDetails: z.string().optional(),
})

const CommitInfoSchema = z.object({
  hash: z.string().optional(),
  message: z.string().optional(),
  branch: z.string().optional(),
})

const ShippedItemSchema = z.object({
  id: z.string(), // ship_xxxxxxxx
  name: z.string(),
  version: z.string().nullable().optional(),
  type: ShipTypeSchema,
  agent: z.string().optional(), // "fe+be", "be", "fe"
  description: z.string().optional(),
  changes: z.array(ShipChangeSchema).optional(),
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
  shipped: z.array(ShippedItemSchema),
  lastUpdated: z.string(),
})
