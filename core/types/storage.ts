/**
 * Storage Types
 * Types for data persistence layer.
 */

// =============================================================================
// Project JSON Types (project.json)
// =============================================================================

export interface ProjectJson {
  projectId: string
  repoPath?: string
  path?: string
  name?: string
  version?: string
  cliVersion?: string
  techStack?: string[]
  fileCount?: number
  commitCount?: number
  stack?: string
  currentBranch?: string
  hasUncommittedChanges?: boolean
  createdAt?: string
  lastSync?: string
  integrations?: {
    linear?: {
      enabled: boolean
      authMode?: string
      teamId?: string
      teamName?: string
      teamKey?: string
      setupAt?: string
    }
    jira?: {
      enabled: boolean
    }
  }
  lastSyncCommit?: string
  lastSyncBranch?: string
  hooks?: {
    enabled: boolean
    strategy?: string
    hooks?: unknown[]
  }
}

// =============================================================================
// State JSON Types (state.json)
// =============================================================================

export interface StateTask {
  id: string
  description: string
  type?: string
  status: string
  startedAt: string
  shippedAt?: string
  prUrl?: string
  subtasks?: Array<{ description: string; status: string }>
  currentSubtaskIndex?: number
  parentDescription?: string
  branch?: string
  linearId?: string | null
  linearUuid?: string | null
  duration?: string
  sessionId?: string
  featureId?: string
  pausedAt?: string
  pauseReason?: string
  expectedValue?: {
    type: string
    impact: string
    successCriteria: string[]
  }
}

export interface StateJson {
  currentTask: StateTask | null
  pausedTasks?: StateTask[]
  previousTask: StateTask | null
  lastUpdated?: string
  projectId?: string
  stack?: { language: string; framework: string }
  domains?: Record<string, boolean>
  projectType?: string
  metrics?: { totalFiles: number }
  lastSync?: string
  context?: {
    lastSession: string
    lastAction: string
    nextAction: string
  }
}

// =============================================================================
// Queue JSON Types (queue.json)
// =============================================================================

export interface QueueTask {
  id: string
  description: string
  body?: string
  type?: string
  priority?: string
  section?: string
  createdAt: string
  completed?: boolean
  completedAt?: string
  featureId?: string
  featureName?: string
}

export interface TaskComment {
  id: string
  taskId: string
  author: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface QueueJson {
  tasks: QueueTask[]
  lastUpdated?: string
}

// =============================================================================
// Roadmap JSON Types (roadmap.json)
// =============================================================================

export interface RoadmapJson {
  features: unknown[]
  backlog: unknown[]
  lastUpdated: string
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

export type IdeaStatus = 'pending' | 'converted' | 'completed' | 'archived' | 'dormant'
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

// =============================================================================
// Metrics Storage Types
// =============================================================================

/**
 * Daily stats for trend analysis
 */
export interface DailyStats {
  date: string // YYYY-MM-DD
  tokensSaved: number // Tokens saved that day
  syncs: number // Number of syncs
  avgCompressionRate: number // Average compression rate (0-1)
  totalDuration: number // Total sync time in ms
}

/**
 * Agent usage tracking
 */
export interface AgentUsage {
  agentName: string // e.g., "backend", "frontend"
  usageCount: number // Times invoked
  tokensSaved: number // Tokens saved by this agent
}

/**
 * Metrics collection for value dashboard
 */
export interface MetricsJson {
  // Token metrics
  totalTokensSaved: number
  avgCompressionRate: number // 0-1 (e.g., 0.63 = 63% reduction)

  // Sync metrics
  syncCount: number
  watchTriggers: number // Auto-syncs from watch mode
  avgSyncDuration: number // Average in ms
  totalSyncDuration: number // Total in ms

  // Agent usage
  agentUsage: AgentUsage[]

  // Time series for trends
  dailyStats: DailyStats[]

  // Metadata
  firstSync: string // ISO8601 - when tracking started
  lastUpdated: string // ISO8601
}
