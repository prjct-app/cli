/**
 * Memory Types
 * Types for the memory system that tracks user preferences and patterns.
 */

/**
 * Semantic tags for memory categorization.
 * Use these constants instead of raw strings.
 */
export const MEMORY_TAGS = {
  // Code preferences
  CODE_STYLE: 'code_style',
  NAMING_CONVENTION: 'naming_convention',
  FILE_STRUCTURE: 'file_structure',

  // Workflow preferences
  COMMIT_STYLE: 'commit_style',
  BRANCH_NAMING: 'branch_naming',
  TEST_BEHAVIOR: 'test_behavior',
  SHIP_WORKFLOW: 'ship_workflow',

  // Project context
  TECH_STACK: 'tech_stack',
  ARCHITECTURE: 'architecture',
  DEPENDENCIES: 'dependencies',

  // User preferences
  OUTPUT_VERBOSITY: 'output_verbosity',
  CONFIRMATION_LEVEL: 'confirmation_level',
  AGENT_PREFERENCE: 'agent_preference',
} as const

export type MemoryTag = (typeof MEMORY_TAGS)[keyof typeof MEMORY_TAGS]

/**
 * A single memory entry.
 */
export interface Memory {
  id: string
  title: string
  content: string
  tags: MemoryTag[]
  userTriggered: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Metadata associated with a memory entry.
 */
export interface MemoryMetadata {
  /** Command that created this memory */
  command?: string
  /** Confidence score (0-1) */
  confidence?: number
  /** Related task ID */
  taskId?: string
  /** Related feature name */
  feature?: string
  /** Source of the memory */
  source?: 'user' | 'system' | 'learned'
}

/**
 * Query parameters for memory retrieval.
 */
export interface MemoryQuery {
  type?: string
  tags?: string[]
  limit?: number
  since?: string
}

/**
 * Memory database structure.
 */
export interface MemoryDatabase {
  version: number
  memories: Memory[]
  /** Index of tag -> memory IDs (uses string for flexibility with dynamic tags) */
  index: Record<string, string[]>
}

/**
 * A history entry from session logs.
 */
export interface HistoryEntry extends Record<string, unknown> {
  /** Timestamp */
  ts: string
  /** Event type */
  type: HistoryEventType
  /** Command that triggered this event */
  command?: string
  /** Task description */
  task?: string
  /** Feature name */
  feature?: string
  /** Duration if applicable */
  duration?: string
  /** Success status */
  success?: boolean
  /** Error message if failed */
  error?: string
}

export type HistoryEventType =
  | 'task_started'
  | 'task_completed'
  | 'task_paused'
  | 'task_resumed'
  | 'feature_added'
  | 'feature_shipped'
  | 'idea_captured'
  | 'decision'
  | 'command_executed'
  | 'error_occurred'

/**
 * A tracked decision and its frequency.
 */
export interface Decision {
  value: string
  count: number
  firstSeen: string
  lastSeen: string
  confidence: 'low' | 'medium' | 'high'
  contexts: string[]
}

/**
 * A tracked workflow pattern.
 */
export interface Workflow {
  /** Times this workflow was executed */
  count: number
  firstSeen: string
  lastSeen: string
  /** Average duration */
  avgDuration?: string
  /** Success rate (0-1) */
  successRate?: number
  /** Steps in the workflow */
  steps?: string[]
}

/**
 * A user preference value.
 */
export interface Preference {
  value: string | number | boolean
  updatedAt: string
}

/**
 * Aggregated patterns learned from history.
 */
export interface Patterns {
  version: number
  decisions: Record<string, Decision>
  preferences: Record<string, Preference>
  workflows: Record<string, Workflow>
  counters: Record<string, number>
}

/**
 * Context passed to memory system operations.
 */
export interface MemoryContext {
  /** Command being executed */
  commandName?: string
  /** Command parameters */
  params?: MemoryContextParams
  /** Project path */
  projectPath?: string
  /** Current task */
  currentTask?: string
}

export interface MemoryContextParams {
  task?: string
  description?: string
  feature?: string
  idea?: string
}
