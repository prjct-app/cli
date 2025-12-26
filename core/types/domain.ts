/**
 * Domain Types
 * Types for domain layer modules.
 */

// =============================================================================
// Task Stack Types
// =============================================================================

export interface TaskStackEntry {
  id: string
  task: string
  status: 'active' | 'paused' | 'blocked'
  startedAt: string
  pausedAt?: string
  estimate?: string
  context?: string
}

export interface ParsedNowFile {
  currentTask: string | null
  stack: TaskStackEntry[]
  metadata: Record<string, unknown>
}

export interface TaskStackMigrationResult {
  success: boolean
  message: string
  entriesMigrated: number
}

export interface TaskSwitchResult {
  previousTask: string | null
  newTask: string
  stackDepth: number
}

export interface TaskStackSummary {
  activeTask: string | null
  pausedCount: number
  totalDepth: number
  oldestTask?: string
}
