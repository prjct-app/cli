/**
 * Storage Types
 * Types for data persistence layer.
 */

// =============================================================================
// Core Storage Interface
// =============================================================================

/**
 * Generic storage interface for granular data access
 */
export interface Storage {
  write<T>(path: string[], data: T): Promise<void>
  read<T>(path: string[]): Promise<T | null>
  list(prefix: string[]): Promise<string[][]>
  delete(path: string[]): Promise<void>
  exists(path: string[]): Promise<boolean>
}

// =============================================================================
// Shipped Storage Types
// =============================================================================

/**
 * Shipped feature record (simple version used by shipped-storage.ts)
 */
export interface ShippedFeature {
  id: string
  name: string
  shippedAt: string
  version: string
  description?: string
  tasks?: string[]
  duration?: string
  type?: 'feature' | 'fix' | 'improvement' | 'refactor'
  agent?: string
  changes?: ShipChange[]
  codeSnippets?: string[]
  commit?: CommitInfo
  codeMetrics?: CodeMetrics
  qualityMetrics?: QualityMetrics
  quantitativeImpact?: string
  tasksCompleted?: number
  featureId?: string
}

export interface ShipChange {
  description: string
  type: 'added' | 'changed' | 'fixed' | 'removed'
}

export interface CommitInfo {
  hash: string
  message: string
  branch: string
}

export interface CodeMetrics {
  filesChanged: number
  linesAdded: number
  linesRemoved: number
  commits: number
}

export interface QualityMetrics {
  lintStatus: 'pass' | 'warning' | 'fail' | 'skipped'
  lintDetails?: string
  testStatus: 'pass' | 'warning' | 'fail' | 'skipped'
  testDetails?: string
}

export interface Duration {
  hours: number
  minutes: number
  totalMinutes: number
}

/**
 * Shipped items collection
 */
export interface ShippedJson {
  shipped: ShippedFeature[]
  lastUpdated: string
}

// =============================================================================
// Ideas Storage Types
// =============================================================================

export type IdeaStatus = 'pending' | 'converted' | 'completed' | 'archived'
export type IdeaPriority = 'low' | 'medium' | 'high'

/**
 * Idea record
 */
export interface Idea {
  id: string
  text: string
  status: IdeaStatus
  priority: IdeaPriority
  tags: string[]
  addedAt: string
  convertedTo?: string
  details?: string
  painPoints?: string[]
  solutions?: string[]
  filesAffected?: string[]
  impactEffort?: ImpactEffort
  stack?: TechStack
  modules?: IdeaModule[]
  roles?: IdeaRole[]
  risks?: string[]
  risksCount?: number
  createdAt?: string
}

export interface ImpactEffort {
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
}

export interface TechStack {
  frontend?: string
  backend?: string
  payments?: string
  ai?: string
  deploy?: string
  other?: string[]
}

export interface IdeaModule {
  name: string
  description: string
}

export interface IdeaRole {
  name: string
  description: string
}

/**
 * Ideas collection
 */
export interface IdeasJson {
  ideas: Idea[]
  lastUpdated: string
}
