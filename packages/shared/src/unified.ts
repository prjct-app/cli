/**
 * Unified State Types
 *
 * Types shared between CLI core modules and web UI.
 * These mirror the types in core/state/, core/outcomes/, and core/agents/
 */

// ============== State Types ==============

export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'paused'
export type FeatureStatus = 'planned' | 'in_progress' | 'completed' | 'shipped'

export interface CurrentTask {
  id: string
  description: string
  startedAt: string
  agent?: string
  agentConfidence?: number
  estimatedDuration?: string
  featureId?: string
  pausedAt?: string
  pauseReason?: string
}

export interface QueuedTask {
  id: string
  description: string
  priority: Priority
  featureId?: string
  estimatedDuration?: string
  tags?: string[]
  createdAt: string
  blockedReason?: string
}

export interface ActiveFeature {
  id: string
  name: string
  status: FeatureStatus
  tasksCompleted: number
  tasksRemaining: number
  estimatedEffort?: string
  actualEffort?: string
  startedAt: string
}

export interface PerformanceStats {
  tasksToday: number
  tasksThisWeek: number
  avgDuration: string
  velocity: string
  estimateAccuracy: number
  streak: number
}

export interface RecentActivity {
  type: 'task_completed' | 'feature_shipped' | 'idea_captured' | 'session_started'
  description: string
  timestamp: string
  duration?: string
}

export interface ProjectState {
  projectId: string
  currentTask: CurrentTask | null
  queue: QueuedTask[]
  activeFeature: ActiveFeature | null
  stats: PerformanceStats
  recentActivity: RecentActivity[]
  lastSync: string
  version: number
}

// ============== Outcomes Types ==============

export type QualityScore = 1 | 2 | 3 | 4 | 5

export interface Outcome {
  id: string
  sessionId: string
  command: string
  task: string
  startedAt: string
  completedAt: string
  estimatedDuration: string
  actualDuration: string
  variance: string
  completedAsPlanned: boolean
  qualityScore: QualityScore
  blockers?: string[]
  errors?: string[]
  agentUsed?: string
  agentConfidence?: number
  agentPerformedWell?: boolean
  patternDetected?: string
  nextTimeEstimate?: string
  tags?: string[]
}

export interface OutcomeSummary {
  totalOutcomes: number
  avgQualityScore: number
  estimateAccuracy: number
  topBlockers: string[]
  topAgents: string[]
  patternsDetected: string[]
}

// ============== Agent Types ==============

export type TaskType =
  | 'frontend'
  | 'backend'
  | 'devops'
  | 'database'
  | 'testing'
  | 'documentation'
  | 'refactoring'
  | 'bugfix'
  | 'feature'
  | 'design'
  | 'other'

export interface AgentPerformance {
  agentName: string
  taskType: TaskType
  tasksCompleted: number
  successRate: number
  avgDuration: string
  estimateAccuracy: number
  improving: boolean
  lastUpdated: string
  bestFor: TaskType[]
  avoidFor: TaskType[]
}

export interface AgentSuggestion {
  agentName: string
  confidence: number
  reason: string
  alternatives?: string[]
}

// ============== Unified API Response ==============

export interface ProjectInsights {
  healthScore: number
  estimateAccuracy: number
  topBlockers: string[]
  patternsDetected: string[]
  recommendations: string[]
}

export interface UnifiedProjectData {
  state: ProjectState | null
  outcomes: OutcomeSummary | null
  agentPerformance: AgentPerformance[]
  insights: ProjectInsights
  legacyFallback: boolean
}

export interface UnifiedApiResponse {
  success: boolean
  version: 'v2' | 'v1-legacy'
  state: ProjectState | null
  outcomes: OutcomeSummary | null
  agentPerformance: AgentPerformance[]
  insights: ProjectInsights
  legacyFallback: boolean
  // Legacy data when fallback
  legacyData?: unknown
  legacyRaw?: unknown
}
