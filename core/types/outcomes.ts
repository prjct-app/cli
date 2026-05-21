/**
 * Outcome Types
 * Types for recording and analyzing execution results.
 */

// Quality Types

/**
 * Quality score for task completion.
 * 1 = Poor, 5 = Excellent
 */
export type QualityScore = 1 | 2 | 3 | 4 | 5

// Outcome Types

/**
 * Outcome of a command or task execution.
 */
export interface Outcome {
  /** Unique outcome ID */
  id: string

  /** Session this outcome belongs to */
  sessionId: string

  /** Command that was executed */
  command: string

  /** Task description */
  task: string

  // =========== Timing ===========

  /** When execution started */
  startedAt: string

  /** When execution completed */
  completedAt: string

  /** Estimated duration (before execution) */
  estimatedDuration: string

  /** Actual duration */
  actualDuration: string

  /**
   * Variance from estimate.
   * Positive = took longer ("+30m")
   * Negative = faster ("-15m")
   */
  variance: string

  // =========== Quality ===========

  /** Whether task was completed as planned */
  completedAsPlanned: boolean

  /** Quality score (1-5) */
  qualityScore: QualityScore

  /** Blockers encountered during execution */
  blockers?: string[]

  /** Error messages if any */
  errors?: string[]

  // =========== Agent ===========

  /** Agent used for this task */
  agentUsed?: string

  /** Agent confidence level (0-1) */
  agentConfidence?: number

  /** Whether agent performed well */
  agentPerformedWell?: boolean

  // =========== Learning ===========

  /** Pattern detected from this execution */
  patternDetected?: string

  /** Suggested estimate for similar tasks */
  nextTimeEstimate?: string

  /** Tags for categorization */
  tags?: string[]
}

/**
 * Summary of outcomes for analysis.
 */
export interface OutcomeSummary {
  /** Total outcomes analyzed */
  totalOutcomes: number

  /** Average quality score */
  avgQualityScore: number

  /** Estimate accuracy percentage (0-100) */
  estimateAccuracy: number

  /** Most common blockers */
  topBlockers: string[]

  /** Best performing agents */
  topAgents: string[]

  /** Patterns detected */
  patternsDetected: string[]
}

/**
 * Outcome filter options.
 */
export interface OutcomeFilter {
  /** Filter by session ID */
  sessionId?: string

  /** Filter by command */
  command?: string

  /** Filter by agent */
  agent?: string

  /** Filter by date range start */
  fromDate?: string

  /** Filter by date range end */
  toDate?: string

  /** Filter by minimum quality */
  minQuality?: QualityScore

  /** Filter by tags */
  tags?: string[]
}

/**
 * Outcome creation input.
 */
export type OutcomeInput = Omit<Outcome, 'id'>

// Analyzer Types

/**
 * Pattern detected from outcomes.
 */
export interface DetectedPattern {
  /** Pattern description */
  description: string

  /** Confidence level (0-1) */
  confidence: number

  /** Number of occurrences supporting this pattern */
  occurrences: number

  /** Suggested action based on pattern */
  suggestedAction?: string
}

/**
 * Agent performance metrics.
 */
export interface AgentMetrics {
  /** Agent name */
  agent: string

  /** Number of tasks completed */
  tasksCompleted: number

  /** Success rate (0-100) */
  successRate: number

  /** Average quality score */
  avgQualityScore: number

  /** Estimate accuracy */
  estimateAccuracy: number

  /** Best task types for this agent */
  bestFor: string[]
}
