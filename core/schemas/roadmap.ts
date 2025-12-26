/**
 * Roadmap Schema
 *
 * Defines the structure for roadmap.json - feature roadmap.
 * Uses Zod for runtime validation and TypeScript type inference.
 *
 * @version 2.0.0
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas - Source of Truth
// =============================================================================

export const FeatureStatusSchema = z.enum(['planned', 'active', 'completed', 'shipped'])
export const FeatureImpactSchema = z.enum(['low', 'medium', 'high'])
export const FeatureTypeSchema = z.enum(['feature', 'breaking_change', 'refactor', 'infrastructure'])
export const PhaseStatusSchema = z.enum(['completed', 'active', 'planned'])

export const FeatureTaskSchema = z.object({
  id: z.string(),               // task_xxxxxxxx
  description: z.string(),
  completed: z.boolean(),
  completedAt: z.string().optional(),
})

export const RoadmapPhaseSchema = z.object({
  id: z.string(),               // P0, P1, etc.
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

export const FeatureItemSchema = z.object({
  id: z.string(),               // feat_xxxxxxxx
  name: z.string(),
  description: z.string().optional(),
  date: z.string(),             // YYYY-MM-DD creation date
  status: FeatureStatusSchema,
  impact: FeatureImpactSchema,
  effort: z.string().optional(),
  progress: z.number(),         // 0-100
  // Enriched fields from MD
  type: FeatureTypeSchema.optional(),
  roi: z.number().optional(),   // 1-5 from star count
  why: z.array(z.string()).optional(),
  technicalNotes: z.array(z.string()).optional(),
  compatibility: z.string().optional(),
  phase: z.string().optional(), // P0, P1, etc.
  tasks: z.array(FeatureTaskSchema),
  createdAt: z.string(),        // ISO8601
  shippedAt: z.string().optional(),
  version: z.string().optional(),
  // ZERO DATA LOSS - additional fields
  duration: FeatureDurationSchema.optional(),
  taskCount: z.number().optional(),
  agent: z.string().optional(), // "fe+be", "fe", "be"
  sprintName: z.string().optional(),
  completedDate: z.string().optional(),
})

export const RoadmapJsonSchema = z.object({
  strategy: RoadmapStrategySchema.nullable().optional(),
  features: z.array(FeatureItemSchema),
  backlog: z.array(z.string()),
  lastUpdated: z.string(),
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
  createdAt: new Date().toISOString()
}

export const DEFAULT_ROADMAP: RoadmapJson = {
  features: [],
  backlog: [],
  lastUpdated: ''
}
