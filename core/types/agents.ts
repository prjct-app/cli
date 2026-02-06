/**
 * Agent Types
 * Types for agent routing and assignment.
 */

import type { ContextDomain } from './agentic'

// ============================================
// Task Types
// ============================================

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
 */
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

/**
 * Task completion record for agent performance tracking.
 */
export interface AgentTaskRecord {
  agentName: string
  taskType: TaskType
  success: boolean
  estimatedDuration: string
  actualDuration: string
  qualityScore: 1 | 2 | 3 | 4 | 5
  completedAt: string
  notes?: string
}

/**
 * Agent routing suggestion.
 */
export interface AgentSuggestion {
  agentName: string
  confidence: number
  reason: string
  alternatives?: string[]
}

/**
 * Agent performance summary for a project.
 */
export interface AgentPerformanceSummary {
  totalAgents: number
  topPerformer: string | null
  mostUsed: string | null
  avgSuccessRate: number
  byTaskType: Record<TaskType, string | null>
}

// ============================================
// Agent Types
// ============================================

/**
 * Agent representation - from simple file to full metadata.
 * Only name and content are required for basic loading.
 */
/** Effort level hint for Claude's adaptive reasoning depth */
export type AgentEffort = 'low' | 'medium' | 'high' | 'max'

export interface Agent {
  name: string
  content: string
  path?: string
  role?: string | null
  domain?: string | null
  skills?: string[]
  effort?: AgentEffort
  model?: string
  modified?: Date
}

/**
 * Consolidated agent info for routing and detection.
 * Combines fields from all previous AgentInfo definitions.
 */
export interface AgentInfo {
  name: string
  type?: string
  domain?: string | ContextDomain
  skills?: string[]
  successRate?: number
  isSupported?: boolean
}

/**
 * Agent routing decision result.
 * Contains the selected agent, confidence, and reasoning.
 */
export interface AgentRouting {
  agent: AgentInfo
  confidence: number
  reason: string
  availableAgents: string[]
}

/**
 * Context for agent assignment decisions.
 * Provides task and environment info for routing.
 */
export interface AssignmentContext {
  task: string
  availableAgents: string[]
  projectPath: string
  projectId: string | null
  _template: string
}

/**
 * Result of agent assignment operation.
 * Contains assigned agent and routing metadata.
 */
export interface AgentAssignmentResult {
  agent: { name: string; domain?: string } | null
  routing: {
    confidence: number
    reason: string
    availableAgents?: string[]
  }
  _agenticNote?: string
}
