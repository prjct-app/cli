/**
 * State Schema
 *
 * Defines the structure for state.json - current task state.
 * Queue is now separate in queue.json.
 *
 * Matches json-loader.ts types exactly.
 */

export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskType = 'feature' | 'bug' | 'improvement' | 'chore'
export type TaskSection = 'active' | 'backlog' | 'previously_active'

export interface CurrentTask {
  id: string                  // task_xxxxxxxx
  description: string
  startedAt: string           // ISO8601
  sessionId: string           // sess_xxxxxxxx
  featureId?: string          // feat_xxxxxxxx
}

export interface PreviousTask {
  id: string
  description: string
  status: 'paused'
  startedAt: string           // ISO8601
  pausedAt: string            // ISO8601
  pauseReason?: string        // Optional reason for pausing
}

// StateJson is the wrapper for state.json file
export interface StateJson {
  currentTask: CurrentTask | null
  previousTask?: PreviousTask | null
  lastUpdated: string
}

// QueueJson is the wrapper for queue.json file
export interface QueueTask {
  id: string                  // task_xxxxxxxx
  description: string
  priority: Priority
  type: TaskType              // detect from emoji 🐛=bug
  featureId?: string
  originFeature?: string      // from "(from: Feature Name)" pattern
  completed: boolean
  completedAt?: string        // ISO8601
  createdAt: string           // ISO8601
  section: TaskSection        // based on MD section
  // Additional fields for ZERO DATA LOSS
  agent?: string              // "fe", "be", "fe + be"
  groupName?: string          // "Sales Reports", "Stock Audits"
  groupId?: string            // For grouping related tasks
}

export interface QueueJson {
  tasks: QueueTask[]
  lastUpdated: string
}

// Legacy types for backwards compatibility
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'paused'
export type ActivityType = 'task_completed' | 'feature_shipped' | 'idea_captured' | 'session_started'

export interface QueuedTask extends QueueTask {} // Alias

export interface Stats {
  tasksToday: number
  tasksThisWeek: number
  streak: number
  velocity: string
  avgDuration: string
}

export interface RecentActivity {
  type: ActivityType
  description: string
  timestamp: string // ISO8601
  duration?: string
}

export interface StateSchema {
  projectId: string
  currentTask: CurrentTask | null
  queue: QueuedTask[]
  stats: Stats
  recentActivity: RecentActivity[]
  lastSync: string // ISO8601
}

// Defaults
export const DEFAULT_STATE: StateJson = {
  currentTask: null,
  lastUpdated: ''
}

export const DEFAULT_QUEUE: QueueJson = {
  tasks: [],
  lastUpdated: ''
}

export const DEFAULT_STATS: Stats = {
  tasksToday: 0,
  tasksThisWeek: 0,
  streak: 0,
  velocity: '0/day',
  avgDuration: '0m'
}
