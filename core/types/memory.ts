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
  /** Confidence level for this memory (optional for backward compatibility) */
  confidence?: ConfidenceLevel
  /** Number of times this memory was reinforced */
  observationCount?: number
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
  confidence: ConfidenceLevel
  contexts: string[]
  /** Whether user explicitly confirmed this decision */
  userConfirmed?: boolean
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
  /** Confidence level based on execution count */
  confidence?: ConfidenceLevel
  /** Whether user explicitly confirmed this workflow */
  userConfirmed?: boolean
}

/**
 * Confidence level for stored preferences and decisions.
 * @see PRJ-104
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high'

/**
 * Calculate confidence level from observation count.
 * - low: 1-2 observations
 * - medium: 3-5 observations
 * - high: 6+ observations or explicit user confirmation
 */
export function calculateConfidence(
  count: number,
  userConfirmed: boolean = false
): ConfidenceLevel {
  if (userConfirmed) return 'high'
  if (count >= 6) return 'high'
  if (count >= 3) return 'medium'
  return 'low'
}

/**
 * A user preference value with confidence scoring.
 * @see PRJ-104
 */
export interface Preference {
  value: string | number | boolean
  updatedAt: string
  /** Confidence level based on observations */
  confidence: ConfidenceLevel
  /** Number of times this preference was observed */
  observationCount: number
  /** Whether user explicitly confirmed this preference */
  userConfirmed: boolean
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
