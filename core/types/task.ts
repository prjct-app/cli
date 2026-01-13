/**
 * Task Types
 * Types for task tracking and analysis.
 */

export interface Task {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  createdAt: string
  completedAt?: string
  duration?: string
  metadata?: TaskMetadata
}

export interface TaskMetadata {
  domain?: string
  complexity?: 'low' | 'medium' | 'high'
  agent?: string
  tags?: string[]
}

/**
 * Result of analyzing a task to determine routing and complexity.
 */
export interface TaskAnalysis {
  /** Primary domain detected (e.g., 'frontend', 'backend', 'devops') */
  primaryDomain: string
  /** Confidence score (0-1) */
  confidence: number
  /** Semantic analysis of task description */
  semantic: SemanticAnalysis
  /** Historical analysis from past similar tasks */
  historical: HistoricalAnalysis
  /** Complexity level */
  complexity: 'low' | 'medium' | 'high'
  /** Project-specific data used in analysis */
  projectData: ProjectAnalysisData
  /** Keywords that matched domain patterns */
  matchedKeywords: string[]
  /** Human-readable reason for domain assignment */
  reason: string
  /** Alternative domains considered */
  alternatives: string[]
}

export interface SemanticAnalysis {
  /** Detected intent */
  intent: string
  /** Key entities in the task */
  entities: string[]
  /** Sentiment score */
  sentiment: number
}

export interface HistoricalAnalysis {
  /** Similar past tasks count */
  similarTasksCount: number
  /** Average duration of similar tasks */
  avgDuration: string | null
  /** Success rate of similar tasks */
  successRate: number
}

export interface ProjectAnalysisData {
  /** Available agents */
  availableAgents: string[]
  /** Stack technologies */
  stack: string[]
  /** Recent activity domains */
  recentDomains: string[]
}
