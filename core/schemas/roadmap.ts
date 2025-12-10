/**
 * Roadmap Schema
 *
 * Defines the structure for roadmap.json - feature roadmap.
 */

export type FeatureStatus = 'planned' | 'in_progress' | 'completed' | 'shipped'
export type FeatureImpact = 'low' | 'medium' | 'high'

export interface FeatureTask {
  description: string
  completed: boolean
}

export interface FeatureSchema {
  id: string
  name: string
  description?: string
  status: FeatureStatus
  impact: FeatureImpact
  effort?: string
  tasks: FeatureTask[]
  createdAt: string // ISO8601
  completedAt?: string // ISO8601
}

export type RoadmapSchema = FeatureSchema[]

export const DEFAULT_FEATURE: Omit<FeatureSchema, 'id' | 'name'> = {
  status: 'planned',
  impact: 'medium',
  tasks: [],
  createdAt: new Date().toISOString()
}
