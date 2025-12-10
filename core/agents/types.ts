/**
 * Agent Types
 *
 * Types for agent performance tracking and management.
 */

/**
 * Task type categories for agent routing.
 */
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

/**
 * Agent performance record.
 *
 * @property agentName - Name of the agent
 * @property taskType - Type of tasks this agent handles
 * @property tasksCompleted - Total tasks completed
 */
export interface AgentPerformance {
  /** Agent name (e.g., "fe", "be", "devops") */
  agentName: string

  /** Primary task type this agent handles */
  taskType: TaskType

  /** Total tasks completed by this agent */
  tasksCompleted: number

  /** Success rate (0-100) */
  successRate: number

  /** Average task duration */
  avgDuration: string

  /** Estimate accuracy (0-100) */
  estimateAccuracy: number

  /** Whether performance is improving */
  improving: boolean

  /** When this record was last updated */
  lastUpdated: string

  /** Task types this agent excels at */
  bestFor: TaskType[]

  /** Task types to avoid for this agent */
  avoidFor: TaskType[]
}

/**
 * Task completion record for agent performance tracking.
 */
export interface AgentTaskRecord {
  /** Agent that completed the task */
  agentName: string

  /** Type of task */
  taskType: TaskType

  /** Whether task was completed successfully */
  success: boolean

  /** Estimated duration */
  estimatedDuration: string

  /** Actual duration */
  actualDuration: string

  /** Quality score (1-5) */
  qualityScore: 1 | 2 | 3 | 4 | 5

  /** When task was completed */
  completedAt: string

  /** Optional notes about performance */
  notes?: string
}

/**
 * Agent routing suggestion.
 */
export interface AgentSuggestion {
  /** Recommended agent */
  agentName: string

  /** Confidence in this suggestion (0-1) */
  confidence: number

  /** Reason for this suggestion */
  reason: string

  /** Alternative agents */
  alternatives?: string[]
}

/**
 * Agent performance summary for a project.
 */
export interface AgentPerformanceSummary {
  /** Total agents tracked */
  totalAgents: number

  /** Best performing agent */
  topPerformer: string | null

  /** Agent with most tasks */
  mostUsed: string | null

  /** Average success rate across all agents */
  avgSuccessRate: number

  /** Performance by task type */
  byTaskType: Record<TaskType, string | null>
}
