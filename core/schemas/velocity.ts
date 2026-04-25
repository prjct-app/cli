/**
 * Velocity Schema (PRJ-296)
 *
 * Defines the structure for velocity tracking:
 * - Sprint-based velocity with configurable sprint length
 * - Estimation accuracy trends
 * - Over/under estimation patterns
 * - Completion projections
 *
 * @version 1.0.0
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas - Source of Truth
// =============================================================================

export const VelocityTrendSchema = z.enum(['improving', 'stable', 'declining'])

export const SprintVelocitySchema = z.object({
  sprintNumber: z.number(),
  startDate: z.string(), // ISO8601
  endDate: z.string(), // ISO8601
  pointsCompleted: z.number(),
  tasksCompleted: z.number(),
  avgVariance: z.number(), // Average estimation variance (%)
  estimationAccuracy: z.number(), // % of tasks within tolerance
})

export const EstimationPatternSchema = z.object({
  category: z.string(), // task type or domain
  avgVariance: z.number(), // positive = over, negative = under
  taskCount: z.number(),
})

export const CompletionProjectionSchema = z.object({
  totalPoints: z.number(),
  sprints: z.number(),
  estimatedDate: z.string(), // ISO8601
})

export const VelocityMetricsSchema = z.object({
  sprints: z.array(SprintVelocitySchema),
  averageVelocity: z.number(),
  velocityTrend: VelocityTrendSchema,
  estimationAccuracy: z.number(), // 0-100%
  overEstimated: z.array(EstimationPatternSchema),
  underEstimated: z.array(EstimationPatternSchema),
  lastUpdated: z.string(), // ISO8601
})

export const VelocityConfigSchema = z.object({
  sprintLengthDays: z.number().min(1).max(90).default(7),
  startDay: z
    .enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .default('monday'),
  windowSize: z.number().min(1).max(52).default(6), // number of sprints for rolling average
  accuracyTolerance: z.number().min(0).max(100).default(20), // ±% for "accurate" estimate
})

// =============================================================================
// Inferred Types
// =============================================================================

export type VelocityTrend = z.infer<typeof VelocityTrendSchema>
export type SprintVelocity = z.infer<typeof SprintVelocitySchema>
export type EstimationPattern = z.infer<typeof EstimationPatternSchema>
export type CompletionProjection = z.infer<typeof CompletionProjectionSchema>
export type VelocityMetrics = z.infer<typeof VelocityMetricsSchema>
export type VelocityConfig = z.input<typeof VelocityConfigSchema>

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_VELOCITY_CONFIG: VelocityConfig = {
  sprintLengthDays: 7,
  startDay: 'monday',
  windowSize: 6,
  accuracyTolerance: 20,
}

export const DEFAULT_VELOCITY_METRICS: VelocityMetrics = {
  sprints: [],
  averageVelocity: 0,
  velocityTrend: 'stable',
  estimationAccuracy: 0,
  overEstimated: [],
  underEstimated: [],
  lastUpdated: '',
}

// =============================================================================
// Validation Helpers
// =============================================================================

const _parseVelocityMetrics = (data: unknown): VelocityMetrics => VelocityMetricsSchema.parse(data)

const _safeParseVelocityMetrics = (data: unknown) => VelocityMetricsSchema.safeParse(data)

const _parseVelocityConfig = (data: unknown) => VelocityConfigSchema.parse(data)
