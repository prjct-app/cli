/**
 * Task Stack Types
 */

export interface TaskEntry {
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

export interface ParsedNowFile {
  description: string
  started: string | null
  agent: string | null
  complexity: string | null
  dev: string | null
}

export interface MigrationResult {
  migrated: boolean
  hadTask?: boolean
  task?: TaskEntry
  error?: string
}

export interface SwitchResult {
  paused: TaskEntry | null
  resumed?: TaskEntry
  started?: TaskEntry
  type: 'resumed' | 'started'
}

export interface StackSummary {
  active: TaskEntry | null
  paused: TaskEntry[]
  pausedCount: number
  completed: TaskEntry[]
  completedCount: number
  totalTasks: number
}
