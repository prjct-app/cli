/**
 * Roadmap Schema
 *
 * Defines the structure for roadmap.json - feature roadmap.
 * Uses Zod for runtime validation and TypeScript type inference.
 *
 * Enhanced for AI Orchestration Layer (v0.29.0):
 * - PRD linking (prdId)
 * - Legacy feature support (legacy, inferredFrom)
 * - Quarter-based planning (quarters)
 * - Dependency tracking (dependencies)
 * - Effort tracking (effortEstimate, effortActual)
 * - Value scoring (valueScore)
 *
 * @version 3.0.0
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas - Source of Truth
// =============================================================================

export const FeatureStatusSchema = z.enum(['planned', 'active', 'completed', 'shipped'])
export const FeatureImpactSchema = z.enum(['low', 'medium', 'high'])
export const FeatureTypeSchema = z.enum([
  'feature',
  'breaking_change',
  'refactor',
  'infrastructure',
])
export const PhaseStatusSchema = z.enum(['completed', 'active', 'planned'])
export const QuarterStatusSchema = z.enum(['planned', 'active', 'completed'])
export const InferredFromSchema = z.enum(['git', 'git-branch', 'manual', 'prd'])

export const FeatureTaskSchema = z.object({
  id: z.string(), // task_xxxxxxxx
  description: z.string(),
  completed: z.boolean(),
  completedAt: z.string().optional(),
})

export const RoadmapPhaseSchema = z.object({
  id: z.string(), // P0, P1, etc.
  name: z.string(),
  status: PhaseStatusSchema,
  completedAt: z.string().optional(),
})

export const RoadmapStrategySchema = z.object({
  goal: z.string(),
  phases: z.array(RoadmapPhaseSchema),
  successMetrics: z.array(z.string()).optional(),
})

export const FeatureDurationSchema = z.object({
  hours: z.number(),
  minutes: z.number(),
  totalMinutes: z.number(),
  display: z.string().optional(),
})

// -----------------------------------------------------------------------------
// Git Commit (for legacy features inferred from git)
// -----------------------------------------------------------------------------

export const GitCommitSchema = z.object({
  hash: z.string(),
  message: z.string(),
  date: z.string(),
  author: z.string().optional(),
})

// -----------------------------------------------------------------------------
// Effort Tracking (for PRD comparison)
// -----------------------------------------------------------------------------

export const EffortEstimateSchema = z.object({
  hours: z.number(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  breakdown: z
    .array(
      z.object({
        area: z.string(),
        hours: z.number(),
      })
    )
    .optional(),
})

export const EffortActualSchema = z.object({
  hours: z.number().optional(),
  commits: z.number().optional(),
  linesAdded: z.number().optional(),
  linesRemoved: z.number().optional(),
})

export const FeatureEffortSchema = z.object({
  estimated: EffortEstimateSchema.nullable(),
  actual: EffortActualSchema.nullable(),
})

// -----------------------------------------------------------------------------
// Quarter (for capacity planning)
// -----------------------------------------------------------------------------

export const QuarterCapacitySchema = z.object({
  totalHours: z.number(),
  allocatedHours: z.number(),
  bufferPercent: z.number().optional(), // % reserved for unknowns
})

export const QuarterSchema = z.object({
  id: z.string(), // Q1-2026
  name: z.string(), // "Q1 2026"
  theme: z.string().optional(), // "Foundation"
  goals: z.array(z.string()).optional(),
  features: z.array(z.string()), // Feature IDs
  capacity: QuarterCapacitySchema.optional(),
  status: QuarterStatusSchema,
  startDate: z.string().optional(), // ISO8601
  endDate: z.string().optional(), // ISO8601
})

// -----------------------------------------------------------------------------
// Feature Item (enhanced)
// -----------------------------------------------------------------------------

export const FeatureItemSchema = z.object({
  id: z.string(), // feat_xxxxxxxx
  name: z.string(),
  description: z.string().optional(),
  date: z.string(), // YYYY-MM-DD creation date
  status: FeatureStatusSchema,
  impact: FeatureImpactSchema,
  effort: z.string().optional(),
  progress: z.number(), // 0-100
  // Enriched fields from MD
  type: FeatureTypeSchema.optional(),
  roi: z.number().optional(), // 1-5 from star count
  why: z.array(z.string()).optional(),
  technicalNotes: z.array(z.string()).optional(),
  compatibility: z.string().optional(),
  phase: z.string().optional(), // P0, P1, etc.
  tasks: z.array(FeatureTaskSchema),
  createdAt: z.string(), // ISO8601
  shippedAt: z.string().optional(),
  version: z.string().optional(),
  // ZERO DATA LOSS - additional fields
  duration: FeatureDurationSchema.optional(),
  taskCount: z.number().optional(),
  agent: z.string().optional(), // "fe+be", "fe", "be"
  sprintName: z.string().optional(),
  completedDate: z.string().optional(),

  // =========================================================================
  // AI ORCHESTRATION FIELDS (v0.29.0)
  // =========================================================================

  // PRD Integration
  prdId: z.string().nullable().optional(), // Link to PRD (prd_xxxxxxxx)

  // Legacy Support (for existing projects)
  legacy: z.boolean().optional(), // true = no PRD required
  inferredFrom: InferredFromSchema.optional(), // git, git-branch, manual, prd

  // Quarter Planning
  quarter: z.string().nullable().optional(), // Q1-2026, etc.

  // Dependency Tracking
  dependencies: z.array(z.string()).optional(), // Feature IDs this depends on
  blockedBy: z.array(z.string()).optional(), // Feature IDs blocking this

  // Effort Tracking (for PRD comparison)
  effortTracking: FeatureEffortSchema.optional(),

  // Value Scoring (calculated from PRD)
  valueScore: z.number().optional(), // Calculated priority score

  // Git Data (for legacy features)
  commits: z.array(GitCommitSchema).optional(), // Commits for this feature
  branch: z.string().optional(), // Branch name (for active)
  commitsAhead: z.number().optional(), // Commits ahead of main
})

// -----------------------------------------------------------------------------
// Backlog Item (enhanced)
// -----------------------------------------------------------------------------

export const BacklogItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  prdId: z.string().nullable().optional(),
  valueScore: z.number().optional(),
  effortEstimate: z.number().optional(),
  reason: z.string().optional(), // Why in backlog
})

// -----------------------------------------------------------------------------
// Roadmap JSON (enhanced)
// -----------------------------------------------------------------------------

export const RoadmapJsonSchema = z.object({
  strategy: RoadmapStrategySchema.nullable().optional(),
  features: z.array(FeatureItemSchema),
  backlog: z.array(z.union([z.string(), BacklogItemSchema])), // Support both formats
  lastUpdated: z.string(),

  // AI ORCHESTRATION FIELDS (v0.29.0)
  quarters: z.array(QuarterSchema).optional(),

  // Metadata (for git-inferred roadmaps)
  generatedFrom: z.enum(['git-history', 'manual', 'prd']).optional(),
  generatedAt: z.string().optional(),
})

// =============================================================================
// Inferred Types - Backward Compatible
// =============================================================================

export type FeatureStatus = z.infer<typeof FeatureStatusSchema>
export type FeatureImpact = z.infer<typeof FeatureImpactSchema>
export type FeatureType = z.infer<typeof FeatureTypeSchema>
export type FeatureTask = z.infer<typeof FeatureTaskSchema>
export type RoadmapPhase = z.infer<typeof RoadmapPhaseSchema>
export type RoadmapStrategy = z.infer<typeof RoadmapStrategySchema>
export type FeatureDuration = z.infer<typeof FeatureDurationSchema>
export type FeatureSchema = z.infer<typeof FeatureItemSchema>
export type RoadmapJson = z.infer<typeof RoadmapJsonSchema>

// Legacy type for backwards compatibility
export type RoadmapSchema = FeatureSchema[]

// AI Orchestration types (v0.29.0)
export type QuarterStatus = z.infer<typeof QuarterStatusSchema>
export type InferredFrom = z.infer<typeof InferredFromSchema>
export type GitCommit = z.infer<typeof GitCommitSchema>
export type EffortEstimate = z.infer<typeof EffortEstimateSchema>
export type EffortActual = z.infer<typeof EffortActualSchema>
export type FeatureEffort = z.infer<typeof FeatureEffortSchema>
export type QuarterCapacity = z.infer<typeof QuarterCapacitySchema>
export type Quarter = z.infer<typeof QuarterSchema>
export type BacklogItem = z.infer<typeof BacklogItemSchema>

// =============================================================================
// Validation Helpers
// =============================================================================

/** Parse and validate roadmap.json content */
export const parseRoadmap = (data: unknown): RoadmapJson => RoadmapJsonSchema.parse(data)
export const safeParseRoadmap = (data: unknown) => RoadmapJsonSchema.safeParse(data)

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_FEATURE: Omit<FeatureSchema, 'id' | 'name'> = {
  date: new Date().toISOString().split('T')[0],
  status: 'planned',
  impact: 'medium',
  progress: 0,
  tasks: [],
  createdAt: new Date().toISOString(),
  // AI Orchestration defaults
  prdId: null,
  legacy: false,
  quarter: null,
}

export const DEFAULT_ROADMAP: RoadmapJson = {
  features: [],
  backlog: [],
  lastUpdated: '',
  // AI Orchestration defaults
  quarters: [],
}

// =============================================================================
// Helper Functions (for AI Orchestration)
// =============================================================================

/**
 * Check if a feature is legacy (no PRD required)
 */
export const isLegacyFeature = (feature: FeatureSchema): boolean => {
  return (
    feature.legacy === true ||
    feature.inferredFrom === 'git' ||
    feature.inferredFrom === 'git-branch'
  )
}

/**
 * Calculate feature priority score (value / effort)
 */
export const calculateFeaturePriority = (feature: FeatureSchema): number => {
  const impactScore = { high: 3, medium: 2, low: 1 }[feature.impact] || 2
  const valueScore = feature.valueScore ?? impactScore * 3

  const estimatedHours = feature.effortTracking?.estimated?.hours ?? 8
  const effortScore = estimatedHours / 10

  return effortScore > 0 ? valueScore / effortScore : valueScore
}

/**
 * Get features for a specific quarter
 */
export const getQuarterFeatures = (roadmap: RoadmapJson, quarterId: string): FeatureSchema[] => {
  return roadmap.features.filter((f) => f.quarter === quarterId)
}

/**
 * Get quarter capacity utilization percentage
 */
export const getQuarterUtilization = (roadmap: RoadmapJson, quarterId: string): number => {
  const quarter = roadmap.quarters?.find((q) => q.id === quarterId)
  if (!quarter?.capacity) return 0

  const { allocatedHours, totalHours } = quarter.capacity
  return totalHours > 0 ? (allocatedHours / totalHours) * 100 : 0
}
