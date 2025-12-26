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
// Storage Item Types
// =============================================================================

/**
 * Shipped feature record
 */
export interface ShippedFeature {
  id: string
  name: string
  version?: string
  type: 'feature' | 'fix' | 'improvement' | 'refactor'
  agent?: string
  description?: string
  changes: ShipChange[]
  codeSnippets?: string[]
  commit?: CommitInfo
  codeMetrics?: CodeMetrics
  qualityMetrics?: QualityMetrics
  quantitativeImpact?: string
  duration?: Duration
  tasksCompleted?: number
  shippedAt: string
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
  items: ShippedFeature[]
  lastUpdated: string
}

/**
 * Idea record
 */
export interface Idea {
  id: string
  text: string
  details?: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'converted' | 'completed' | 'archived'
  tags?: string[]
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
