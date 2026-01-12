/**
 * Outcomes Schema
 *
 * Defines the structure for outcomes.json - feature completion metrics and learnings.
 * Uses Zod for runtime validation and TypeScript type inference.
 *
 * Enhanced for AI Orchestration Layer (v0.29.0):
 * - PRD/Feature linking
 * - Effort comparison (estimated vs actual)
 * - Success metrics tracking
 * - Learnings capture
 * - ROI calculation
 *
 * @version 2.0.0
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas - Source of Truth
// =============================================================================

export const QualityScoreSchema = z.number().min(1).max(5)
export const SuccessLevelSchema = z.enum(['exceeded', 'met', 'partial', 'failed'])
export const WorthAssessmentSchema = z.enum(['definitely', 'probably', 'maybe', 'no'])
export const VarianceReasonSchema = z.enum([
  'scope_creep',
  'underestimated_complexity',
  'technical_debt',
  'external_blockers',
  'learning_curve',
  'requirements_changed',
  'optimistic_estimate',
  'team_changes',
  'other'
])

// -----------------------------------------------------------------------------
// Effort Tracking
// -----------------------------------------------------------------------------

export const EffortComparisonSchema = z.object({
  estimated: z.object({
    hours: z.number(),
    confidence: z.enum(['low', 'medium', 'high']).optional(),
    source: z.enum(['prd', 'manual', 'historical']).optional(),
  }),
  actual: z.object({
    hours: z.number(),
    commits: z.number().optional(),
    linesAdded: z.number().optional(),
    linesRemoved: z.number().optional(),
    sessions: z.number().optional(),  // Number of work sessions
  }),
  variance: z.object({
    hours: z.number(),          // actual - estimated
    percentage: z.number(),     // ((actual - estimated) / estimated) * 100
    reason: VarianceReasonSchema.optional(),
    explanation: z.string().optional(),
  }),
})

// -----------------------------------------------------------------------------
// Success Metrics (from PRD)
// -----------------------------------------------------------------------------

export const MetricResultSchema = z.object({
  name: z.string(),
  baseline: z.number().nullable(),
  target: z.number(),
  actual: z.number(),
  unit: z.string(),
  achieved: z.boolean(),        // actual >= target (or <= for decrease metrics)
  percentOfTarget: z.number(),  // (actual / target) * 100
})

export const AcceptanceCriteriaResultSchema = z.object({
  criteria: z.string(),
  met: z.boolean(),
  notes: z.string().optional(),
})

export const SuccessTrackingSchema = z.object({
  metrics: z.array(MetricResultSchema),
  acceptanceCriteria: z.array(AcceptanceCriteriaResultSchema),
  overallSuccess: SuccessLevelSchema,
  successScore: z.number().min(0).max(100),  // Percentage of metrics/criteria met
})

// -----------------------------------------------------------------------------
// Learnings
// -----------------------------------------------------------------------------

export const LearningSchema = z.object({
  category: z.enum([
    'estimation',
    'technical',
    'process',
    'communication',
    'tooling',
    'architecture',
    'testing',
    'other'
  ]),
  insight: z.string(),
  actionable: z.boolean(),
  action: z.string().optional(),  // What to do differently next time
})

export const LearningsSchema = z.object({
  whatWorked: z.array(z.string()),
  whatDidnt: z.array(z.string()),
  surprises: z.array(z.string()),
  recommendations: z.array(LearningSchema),
})

// -----------------------------------------------------------------------------
// ROI Assessment
// -----------------------------------------------------------------------------

export const ROIAssessmentSchema = z.object({
  valueDelivered: z.number().min(1).max(10),    // Subjective 1-10 score
  userImpact: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  businessImpact: z.enum(['none', 'low', 'medium', 'high', 'critical']),

  // Calculated: (valueDelivered * 10) / (actual hours)
  roiScore: z.number(),

  // Would you build this again knowing what you know now?
  worthIt: WorthAssessmentSchema,
  worthItReason: z.string().optional(),

  // Comparison to alternatives
  alternativeConsidered: z.string().optional(),
  betterAlternativeExists: z.boolean().optional(),
})

// -----------------------------------------------------------------------------
// Task-Level Outcome (granular)
// -----------------------------------------------------------------------------

export const TaskOutcomeSchema = z.object({
  id: z.string(),                 // out_task_xxxxxxxx
  taskId: z.string(),
  description: z.string(),

  // Time tracking
  estimatedMinutes: z.number().optional(),
  actualMinutes: z.number(),

  // Quality
  completedAsPlanned: z.boolean(),
  qualityScore: QualityScoreSchema,

  // Context
  blockers: z.array(z.string()),
  agentUsed: z.string().optional(),
  skillsUsed: z.array(z.string()).optional(),

  // Timestamps
  startedAt: z.string(),
  completedAt: z.string(),
})

// -----------------------------------------------------------------------------
// Feature-Level Outcome (comprehensive)
// -----------------------------------------------------------------------------

export const FeatureOutcomeSchema = z.object({
  id: z.string(),                 // out_feat_xxxxxxxx

  // Links
  featureId: z.string(),
  featureName: z.string(),
  prdId: z.string().nullable(),   // null for legacy features

  // Version info
  version: z.string().optional(),
  branch: z.string().optional(),
  prUrl: z.string().optional(),

  // Effort
  effort: EffortComparisonSchema,

  // Success (only if PRD exists)
  success: SuccessTrackingSchema.optional(),

  // Learnings
  learnings: LearningsSchema,

  // ROI
  roi: ROIAssessmentSchema,

  // Overall rating
  rating: QualityScoreSchema,

  // Task outcomes (sub-tasks)
  taskOutcomes: z.array(TaskOutcomeSchema).optional(),

  // Timestamps
  startedAt: z.string(),
  shippedAt: z.string(),
  reviewedAt: z.string().optional(),  // When impact was captured

  // Metadata
  reviewedBy: z.string().optional(),  // Who filled out the impact review
  legacy: z.boolean().optional(),     // Legacy feature (no PRD)
})

// -----------------------------------------------------------------------------
// Aggregate Metrics (for dashboard)
// -----------------------------------------------------------------------------

export const AggregateMetricsSchema = z.object({
  totalFeatures: z.number(),
  averageEstimationAccuracy: z.number(),  // Percentage
  averageSuccessRate: z.number(),         // Percentage
  averageROI: z.number(),

  // By category
  bySuccessLevel: z.object({
    exceeded: z.number(),
    met: z.number(),
    partial: z.number(),
    failed: z.number(),
  }),

  // Variance patterns
  variancePatterns: z.array(z.object({
    reason: VarianceReasonSchema,
    count: z.number(),
    averageVariance: z.number(),
  })),

  // Top learnings (aggregated)
  topLearnings: z.array(z.object({
    insight: z.string(),
    frequency: z.number(),
  })),
})

// -----------------------------------------------------------------------------
// Outcomes JSON (storage file)
// -----------------------------------------------------------------------------

export const OutcomesJsonSchema = z.object({
  outcomes: z.array(FeatureOutcomeSchema),
  taskOutcomes: z.array(TaskOutcomeSchema).optional(),  // Standalone task outcomes
  aggregates: AggregateMetricsSchema.optional(),
  lastUpdated: z.string(),
  lastAggregated: z.string().optional(),
})

// =============================================================================
// Inferred Types
// =============================================================================

export type QualityScore = z.infer<typeof QualityScoreSchema>
export type SuccessLevel = z.infer<typeof SuccessLevelSchema>
export type WorthAssessment = z.infer<typeof WorthAssessmentSchema>
export type VarianceReason = z.infer<typeof VarianceReasonSchema>

export type EffortComparison = z.infer<typeof EffortComparisonSchema>
export type MetricResult = z.infer<typeof MetricResultSchema>
export type AcceptanceCriteriaResult = z.infer<typeof AcceptanceCriteriaResultSchema>
export type SuccessTracking = z.infer<typeof SuccessTrackingSchema>
export type Learning = z.infer<typeof LearningSchema>
export type Learnings = z.infer<typeof LearningsSchema>
export type ROIAssessment = z.infer<typeof ROIAssessmentSchema>

export type TaskOutcome = z.infer<typeof TaskOutcomeSchema>
export type FeatureOutcome = z.infer<typeof FeatureOutcomeSchema>
export type AggregateMetrics = z.infer<typeof AggregateMetricsSchema>
export type OutcomesJson = z.infer<typeof OutcomesJsonSchema>

// Legacy type for backwards compatibility
export type OutcomeSchema = TaskOutcome
export type OutcomesSchema = TaskOutcome[]

// =============================================================================
// Validation Helpers
// =============================================================================

/** Parse and validate outcomes.json content */
export const parseOutcomes = (data: unknown): OutcomesJson => OutcomesJsonSchema.parse(data)
export const safeParseOutcomes = (data: unknown) => OutcomesJsonSchema.safeParse(data)

/** Parse a single feature outcome */
export const parseFeatureOutcome = (data: unknown): FeatureOutcome => FeatureOutcomeSchema.parse(data)
export const safeParseFeatureOutcome = (data: unknown) => FeatureOutcomeSchema.safeParse(data)

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_OUTCOMES: OutcomesJson = {
  outcomes: [],
  taskOutcomes: [],
  lastUpdated: '',
}

export const DEFAULT_LEARNINGS: Learnings = {
  whatWorked: [],
  whatDidnt: [],
  surprises: [],
  recommendations: [],
}

export const DEFAULT_ROI: Omit<ROIAssessment, 'roiScore'> = {
  valueDelivered: 5,
  userImpact: 'medium',
  businessImpact: 'medium',
  worthIt: 'probably',
}

// =============================================================================
// Calculation Helpers
// =============================================================================

/**
 * Calculate variance between estimated and actual effort
 */
export const calculateVariance = (
  estimated: number,
  actual: number
): { hours: number; percentage: number } => {
  const hours = actual - estimated
  const percentage = estimated > 0 ? ((actual - estimated) / estimated) * 100 : 0
  return { hours, percentage: Math.round(percentage * 10) / 10 }
}

/**
 * Calculate ROI score: (value * 10) / actual hours
 * Higher is better - more value per hour spent
 */
export const calculateROIScore = (valueDelivered: number, actualHours: number): number => {
  if (actualHours <= 0) return valueDelivered * 10
  return Math.round((valueDelivered * 10 / actualHours) * 100) / 100
}

/**
 * Calculate success score from metrics and acceptance criteria
 */
export const calculateSuccessScore = (
  metrics: MetricResult[],
  acceptanceCriteria: AcceptanceCriteriaResult[]
): number => {
  const totalItems = metrics.length + acceptanceCriteria.length
  if (totalItems === 0) return 100

  const metMetrics = metrics.filter(m => m.achieved).length
  const metCriteria = acceptanceCriteria.filter(ac => ac.met).length

  return Math.round(((metMetrics + metCriteria) / totalItems) * 100)
}

/**
 * Determine overall success level from score
 */
export const determineSuccessLevel = (score: number): SuccessLevel => {
  if (score >= 100) return 'exceeded'
  if (score >= 80) return 'met'
  if (score >= 50) return 'partial'
  return 'failed'
}

/**
 * Calculate estimation accuracy (100% = perfect estimate)
 * Formula: 100 - abs(variance percentage)
 */
export const calculateEstimationAccuracy = (variancePercentage: number): number => {
  return Math.max(0, 100 - Math.abs(variancePercentage))
}

/**
 * Aggregate outcomes for dashboard
 */
export const aggregateOutcomes = (outcomes: FeatureOutcome[]): AggregateMetrics => {
  if (outcomes.length === 0) {
    return {
      totalFeatures: 0,
      averageEstimationAccuracy: 0,
      averageSuccessRate: 0,
      averageROI: 0,
      bySuccessLevel: { exceeded: 0, met: 0, partial: 0, failed: 0 },
      variancePatterns: [],
      topLearnings: [],
    }
  }

  // Calculate averages
  const accuracies = outcomes.map(o =>
    calculateEstimationAccuracy(o.effort.variance.percentage)
  )
  const successRates = outcomes
    .filter(o => o.success)
    .map(o => o.success!.successScore)
  const rois = outcomes.map(o => o.roi.roiScore)

  // Count by success level
  const bySuccessLevel = {
    exceeded: outcomes.filter(o => o.success?.overallSuccess === 'exceeded').length,
    met: outcomes.filter(o => o.success?.overallSuccess === 'met').length,
    partial: outcomes.filter(o => o.success?.overallSuccess === 'partial').length,
    failed: outcomes.filter(o => o.success?.overallSuccess === 'failed').length,
  }

  // Variance patterns
  const varianceReasons = outcomes
    .filter(o => o.effort.variance.reason)
    .reduce((acc, o) => {
      const reason = o.effort.variance.reason!
      if (!acc[reason]) {
        acc[reason] = { count: 0, totalVariance: 0 }
      }
      acc[reason].count++
      acc[reason].totalVariance += o.effort.variance.percentage
      return acc
    }, {} as Record<VarianceReason, { count: number; totalVariance: number }>)

  const variancePatterns = Object.entries(varianceReasons).map(([reason, data]) => ({
    reason: reason as VarianceReason,
    count: data.count,
    averageVariance: Math.round(data.totalVariance / data.count),
  }))

  // Top learnings
  const allLearnings = outcomes.flatMap(o => [
    ...o.learnings.whatWorked,
    ...o.learnings.whatDidnt,
  ])
  const learningCounts = allLearnings.reduce((acc, learning) => {
    acc[learning] = (acc[learning] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topLearnings = Object.entries(learningCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([insight, frequency]) => ({ insight, frequency }))

  return {
    totalFeatures: outcomes.length,
    averageEstimationAccuracy: Math.round(
      accuracies.reduce((a, b) => a + b, 0) / accuracies.length
    ),
    averageSuccessRate: successRates.length > 0
      ? Math.round(successRates.reduce((a, b) => a + b, 0) / successRates.length)
      : 0,
    averageROI: Math.round(rois.reduce((a, b) => a + b, 0) / rois.length * 100) / 100,
    bySuccessLevel,
    variancePatterns,
    topLearnings,
  }
}

// =============================================================================
// Linear/Jira/Monday Mapping Helpers
// =============================================================================

/**
 * Maps success level to PM tool status
 */
export const successLevelToStatus: Record<SuccessLevel, string> = {
  exceeded: 'Exceeded Goals',
  met: 'Completed',
  partial: 'Partially Completed',
  failed: 'Did Not Meet Goals',
}

/**
 * Maps worth assessment to follow-up action
 */
export const worthToAction: Record<WorthAssessment, string> = {
  definitely: 'Replicate pattern',
  probably: 'Document learnings',
  maybe: 'Review approach',
  no: 'Post-mortem required',
}
