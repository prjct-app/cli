/**
 * Roadmap Schema
 *
 * Defines the structure for roadmap.json - feature roadmap.
 * Matches json-loader.ts types exactly.
 */

export type FeatureStatus = 'planned' | 'active' | 'completed' | 'shipped'
export type FeatureImpact = 'low' | 'medium' | 'high'
export type FeatureType = 'feature' | 'breaking_change' | 'refactor' | 'infrastructure'

export interface FeatureTask {
  id: string                    // task_xxxxxxxx
  description: string
  completed: boolean
  completedAt?: string          // ISO8601
}

export interface RoadmapPhase {
  id: string                    // P0, P1, etc.
  name: string
  status: 'completed' | 'active' | 'planned'
  completedAt?: string          // ISO8601
}

export interface RoadmapStrategy {
  goal: string
  phases: RoadmapPhase[]
  successMetrics?: string[]
}

// Duration for completed sprints/features
export interface FeatureDuration {
  hours: number
  minutes: number
  totalMinutes: number
  display?: string              // "~25m", "~1h"
}

export interface FeatureSchema {
  id: string                    // feat_xxxxxxxx
  name: string
  description?: string
  date: string                  // YYYY-MM-DD creation date
  status: FeatureStatus
  impact: FeatureImpact
  effort?: string               // "1-2 days" or similar
  progress: number              // 0-100
  // Enriched fields from MD
  type?: FeatureType
  roi?: number                  // 1-5 from star count
  why?: string[]                // from ### Why This Feature? section
  technicalNotes?: string[]     // from ### Technical Notes section
  compatibility?: string
  phase?: string                // P0, P1, etc.
  tasks: FeatureTask[]
  createdAt: string             // ISO8601
  shippedAt?: string            // ISO8601
  version?: string              // Release version when shipped
  // ZERO DATA LOSS - additional fields
  duration?: FeatureDuration    // "~25m", "~1h" parsed
  taskCount?: number            // "7 tasks" from MD header
  agent?: string                // "fe+be", "fe", "be"
  sprintName?: string           // "Sprint 6 - Reports + Audits"
  completedDate?: string        // "2025-12-09" from MD
}

export interface RoadmapJson {
  strategy?: RoadmapStrategy | null
  features: FeatureSchema[]
  backlog: string[]
  lastUpdated: string
}

// Legacy type for backwards compatibility
export type RoadmapSchema = FeatureSchema[]

export const DEFAULT_FEATURE: Omit<FeatureSchema, 'id' | 'name'> = {
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
