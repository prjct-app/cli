/**
 * Performance Schema
 *
 * Defines metric types for the PerformanceTracker service.
 * Uses JSONL storage (append-only) with rotation at 5MB.
 *
 * @see PRJ-297
 */

import { z } from 'zod'

// =============================================================================
// Metric Schemas
// =============================================================================

export const MetricNameSchema = z.enum([
  'startup_time',
  'heap_used',
  'heap_total',
  'rss',
  'external_memory',
  'context_correctness',
  'subtask_handoff',
  'analysis_state',
  'token_usage',
  'command_duration',
])

export const MemorySnapshotSchema = z.object({
  heapUsed: z.number(),
  heapTotal: z.number(),
  rss: z.number(),
  external: z.number(),
})

export const PerformanceMetricSchema = z.object({
  timestamp: z.string(),
  metric: MetricNameSchema,
  value: z.number(),
  unit: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
})

export const ContextCorrectnessSchema = z.object({
  timestamp: z.string(),
  metric: z.literal('context_correctness'),
  taskId: z.string(),
  receivedSync: z.boolean(),
  syncFieldsInjected: z.array(z.string()).optional(),
  tokensBudgetUsed: z.number().optional(),
  tokensBudgetTotal: z.number().optional(),
})

export const SubtaskHandoffSchema = z.object({
  timestamp: z.string(),
  metric: z.literal('subtask_handoff'),
  taskId: z.string(),
  subtaskId: z.string(),
  outputPopulated: z.boolean(),
})

const AnalysisStateSchema = z.object({
  timestamp: z.string(),
  metric: z.literal('analysis_state'),
  state: z.enum(['draft', 'verified', 'sealed']),
  commitHash: z.string(),
})

/** Union of all metric entry types stored in performance.jsonl */
export const PerformanceEntrySchema = z.union([
  PerformanceMetricSchema,
  ContextCorrectnessSchema,
  SubtaskHandoffSchema,
  AnalysisStateSchema,
])

// =============================================================================
// Report Schemas
// =============================================================================

const MetricSummarySchema = z.object({
  avg: z.number(),
  min: z.number(),
  max: z.number(),
  count: z.number(),
  unit: z.string(),
})

export const PerformanceReportSchema = z.object({
  period: z.string(),
  startup: MetricSummarySchema.optional(),
  memory: z
    .object({
      avgHeapMB: z.number(),
      peakHeapMB: z.number(),
      avgRssMB: z.number(),
    })
    .optional(),
  contextCorrectness: z
    .object({
      total: z.number(),
      receivedSync: z.number(),
      rate: z.number(),
    })
    .optional(),
  subtaskHandoff: z
    .object({
      total: z.number(),
      outputPopulated: z.number(),
      rate: z.number(),
    })
    .optional(),
  commandDurations: z.record(z.string(), MetricSummarySchema).optional(),
})

// =============================================================================
// Inferred Types
// =============================================================================

export type MetricName = z.infer<typeof MetricNameSchema>
export type MemorySnapshot = z.infer<typeof MemorySnapshotSchema>
export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>
export type ContextCorrectness = z.infer<typeof ContextCorrectnessSchema>
export type SubtaskHandoff = z.infer<typeof SubtaskHandoffSchema>
export type PerformanceEntry = z.infer<typeof PerformanceEntrySchema>
export type PerformanceReport = z.infer<typeof PerformanceReportSchema>
