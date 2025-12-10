/**
 * State Schema
 *
 * Defines the structure for state.json - the unified project state.
 */

export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'paused'
export type ActivityType = 'task_completed' | 'feature_shipped' | 'idea_captured' | 'session_started'

export interface CurrentTask {
  id: string
  description: string
  startedAt: string // ISO8601
  agent?: string
  featureId?: string
  estimatedDuration?: string
  pausedAt?: string // ISO8601
  pauseReason?: string
}

export interface QueuedTask {
  id: string
  description: string
  priority: Priority
  featureId?: string
  estimatedDuration?: string
  createdAt: string // ISO8601
  blockedReason?: string
  tags?: string[]
}

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

export const DEFAULT_STATS: Stats = {
  tasksToday: 0,
  tasksThisWeek: 0,
  streak: 0,
  velocity: '0/day',
  avgDuration: '0m'
}

export const DEFAULT_STATE: Omit<StateSchema, 'projectId'> = {
  currentTask: null,
  queue: [],
  stats: DEFAULT_STATS,
  recentActivity: [],
  lastSync: new Date().toISOString()
}
