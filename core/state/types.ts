/**
 * State Types
 *
 * Unified project state that replaces scattered files.
 * This is the single source of truth for project status.
 */

/**
 * Priority levels for tasks.
 */
export type Priority = 'low' | 'medium' | 'high' | 'critical'

/**
 * Task status values.
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'paused'

/**
 * Feature status values.
 */
export type FeatureStatus = 'planned' | 'in_progress' | 'completed' | 'shipped'

/**
 * A task in the queue.
 */
export interface QueuedTask {
  /** Unique task ID */
  id: string
  /** Task description */
  description: string
  /** Priority level */
  priority: Priority
  /** Related feature (if any) */
  featureId?: string
  /** Estimated duration (e.g., "2h", "30m") */
  estimatedDuration?: string
  /** Tags for categorization */
  tags?: string[]
  /** When task was added */
  createdAt: string
  /** Blocking reason if blocked */
  blockedReason?: string
}

/**
 * The currently active task.
 */
export interface CurrentTask {
  /** Unique task ID */
  id: string
  /** Task description */
  description: string
  /** When task started */
  startedAt: string
  /** Assigned agent */
  agent?: string
  /** Agent confidence (0-1) */
  agentConfidence?: number
  /** Estimated duration */
  estimatedDuration?: string
  /** Related feature */
  featureId?: string
  /** Paused state info */
  pausedAt?: string
  /** Reason for pause */
  pauseReason?: string
}

/**
 * Active feature being worked on.
 */
export interface ActiveFeature {
  /** Feature ID */
  id: string
  /** Feature name */
  name: string
  /** Current status */
  status: FeatureStatus
  /** Tasks completed for this feature */
  tasksCompleted: number
  /** Tasks remaining */
  tasksRemaining: number
  /** Total estimated effort */
  estimatedEffort?: string
  /** Actual effort so far */
  actualEffort?: string
  /** When feature was started */
  startedAt: string
}

/**
 * Performance statistics.
 */
export interface PerformanceStats {
  /** Tasks completed today */
  tasksToday: number
  /** Tasks completed this week */
  tasksThisWeek: number
  /** Average task duration */
  avgDuration: string
  /** Tasks per day velocity */
  velocity: string
  /** Estimate accuracy percentage (0-100) */
  estimateAccuracy: number
  /** Streak of consecutive productive days */
  streak: number
}

/**
 * Recent activity entry.
 */
export interface RecentActivity {
  /** Activity type */
  type: 'task_completed' | 'feature_shipped' | 'idea_captured' | 'session_started'
  /** Description */
  description: string
  /** When it happened */
  timestamp: string
  /** Duration if applicable */
  duration?: string
}

/**
 * Unified project state.
 * This replaces reading from now.md, next.md, roadmap.md, etc.
 */
export interface ProjectState {
  /** Project ID */
  projectId: string

  /** Currently active task (null if none) */
  currentTask: CurrentTask | null

  /** Task queue (priority ordered) */
  queue: QueuedTask[]

  /** Active feature being worked on */
  activeFeature: ActiveFeature | null

  /** Performance statistics */
  stats: PerformanceStats

  /** Recent activity (last 10 items) */
  recentActivity: RecentActivity[]

  /** When state was last synced */
  lastSync: string

  /** State version for migrations */
  version: number
}

/**
 * Default empty state.
 */
export const DEFAULT_STATE: ProjectState = {
  projectId: '',
  currentTask: null,
  queue: [],
  activeFeature: null,
  stats: {
    tasksToday: 0,
    tasksThisWeek: 0,
    avgDuration: '0h',
    velocity: '0',
    estimateAccuracy: 0,
    streak: 0,
  },
  recentActivity: [],
  lastSync: new Date().toISOString(),
  version: 1,
}

/**
 * State update operations.
 */
export type StateUpdate =
  | { type: 'SET_CURRENT_TASK'; task: CurrentTask | null }
  | { type: 'ADD_TO_QUEUE'; task: QueuedTask }
  | { type: 'REMOVE_FROM_QUEUE'; taskId: string }
  | { type: 'UPDATE_QUEUE_TASK'; taskId: string; updates: Partial<QueuedTask> }
  | { type: 'SET_ACTIVE_FEATURE'; feature: ActiveFeature | null }
  | { type: 'UPDATE_STATS'; stats: Partial<PerformanceStats> }
  | { type: 'ADD_ACTIVITY'; activity: RecentActivity }
  | { type: 'SYNC' }
