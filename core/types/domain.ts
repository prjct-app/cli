/**
 * Domain Types
 * Types for domain layer modules.
 */

// =============================================================================
// Task Stack Types
// =============================================================================

/**
 * Task entry in the stack (JSONL format)
 */
export interface TaskStackEntry {
  id: string
  task: string
  agent: string
  status: 'active' | 'paused' | 'completed'
  started: string
  paused: string | null
  resumed: string | null
  completed: string | null
  duration: number | null
  durationFormatted?: string
  complexity: string
  dev: string
  pauseReason?: string
  pausedDuration?: number
}

/**
 * Result of migrating from legacy now.md to stack
 */
export interface TaskStackMigrationResult {
  migrated: boolean
  hadTask?: boolean
  task?: TaskStackEntry
  error?: string
}

/**
 * Result of switching between tasks
 */
export interface TaskSwitchResult {
  paused: TaskStackEntry | null
  resumed?: TaskStackEntry
  started?: TaskStackEntry
  type: 'resumed' | 'started'
}

/**
 * Summary of task stack state
 */
export interface TaskStackSummary {
  active: TaskStackEntry | null
  paused: TaskStackEntry[]
  pausedCount: number
  completed: TaskStackEntry[]
  completedCount: number
  totalTasks: number
}
