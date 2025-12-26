/**
 * State Schema
 *
 * Defines the structure for state.json - current task state.
 * Queue is now separate in queue.json.
 *
 * Uses Zod for runtime validation and TypeScript type inference.
 * @version 2.0.0
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas - Source of Truth
// =============================================================================

export const PrioritySchema = z.enum(['low', 'medium', 'high', 'critical'])
export const TaskTypeSchema = z.enum(['feature', 'bug', 'improvement', 'chore'])
export const TaskSectionSchema = z.enum(['active', 'backlog', 'previously_active'])
export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'blocked', 'paused'])
export const ActivityTypeSchema = z.enum(['task_completed', 'feature_shipped', 'idea_captured', 'session_started'])

export const CurrentTaskSchema = z.object({
  id: z.string(),                   // task_xxxxxxxx
  description: z.string(),
  startedAt: z.string(),            // ISO8601
  sessionId: z.string(),            // sess_xxxxxxxx
  featureId: z.string().optional(), // feat_xxxxxxxx
})

export const PreviousTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: z.literal('paused'),
  startedAt: z.string(),            // ISO8601
  pausedAt: z.string(),             // ISO8601
  pauseReason: z.string().optional(),
})

export const StateJsonSchema = z.object({
  currentTask: CurrentTaskSchema.nullable(),
  previousTask: PreviousTaskSchema.nullable().optional(),
  lastUpdated: z.string(),
})

export const QueueTaskSchema = z.object({
  id: z.string(),                   // task_xxxxxxxx
  description: z.string(),
  priority: PrioritySchema,
  type: TaskTypeSchema,             // detect from emoji 🐛=bug
  featureId: z.string().optional(),
  originFeature: z.string().optional(),
  completed: z.boolean(),
  completedAt: z.string().optional(),
  createdAt: z.string(),            // ISO8601
  section: TaskSectionSchema,
  // Additional fields for ZERO DATA LOSS
  agent: z.string().optional(),     // "fe", "be", "fe + be"
  groupName: z.string().optional(), // "Sales Reports", "Stock Audits"
  groupId: z.string().optional(),   // For grouping related tasks
})

export const QueueJsonSchema = z.object({
  tasks: z.array(QueueTaskSchema),
  lastUpdated: z.string(),
})

export const StatsSchema = z.object({
  tasksToday: z.number(),
  tasksThisWeek: z.number(),
  streak: z.number(),
  velocity: z.string(),
  avgDuration: z.string(),
})

export const RecentActivitySchema = z.object({
  type: ActivityTypeSchema,
  description: z.string(),
  timestamp: z.string(),            // ISO8601
  duration: z.string().optional(),
})

export const StateSchemaFull = z.object({
  projectId: z.string(),
  currentTask: CurrentTaskSchema.nullable(),
  queue: z.array(QueueTaskSchema),
  stats: StatsSchema,
  recentActivity: z.array(RecentActivitySchema),
  lastSync: z.string(),             // ISO8601
})

// =============================================================================
// Inferred Types - Backward Compatible
// =============================================================================

export type Priority = z.infer<typeof PrioritySchema>
export type TaskType = z.infer<typeof TaskTypeSchema>
export type TaskSection = z.infer<typeof TaskSectionSchema>
export type TaskStatus = z.infer<typeof TaskStatusSchema>
export type ActivityType = z.infer<typeof ActivityTypeSchema>

export type CurrentTask = z.infer<typeof CurrentTaskSchema>
export type PreviousTask = z.infer<typeof PreviousTaskSchema>
export type StateJson = z.infer<typeof StateJsonSchema>
export type QueueTask = z.infer<typeof QueueTaskSchema>
export type QueueJson = z.infer<typeof QueueJsonSchema>
export type Stats = z.infer<typeof StatsSchema>
export type RecentActivity = z.infer<typeof RecentActivitySchema>
export type StateSchema = z.infer<typeof StateSchemaFull>

// Legacy alias
export type QueuedTask = QueueTask

// =============================================================================
// Validation Helpers
// =============================================================================

/** Parse and validate state.json content */
export const parseState = (data: unknown): StateJson => StateJsonSchema.parse(data)

/** Parse and validate queue.json content */
export const parseQueue = (data: unknown): QueueJson => QueueJsonSchema.parse(data)

/** Safe parse with error result */
export const safeParseState = (data: unknown) => StateJsonSchema.safeParse(data)
export const safeParseQueue = (data: unknown) => QueueJsonSchema.safeParse(data)

// =============================================================================
// Defaults
// =============================================================================

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
