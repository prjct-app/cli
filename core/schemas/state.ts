/**
 * State Schema
 *
 * Defines the structure for state.json - current task state.
 * Queue is now separate in queue.json.
 *
 * Uses Zod for runtime validation and TypeScript type inference.
 */

import { z } from 'zod'
import { ModelMetadataSchema } from './model'

// Zod Schemas - Source of Truth

export const PrioritySchema = z.enum(['low', 'medium', 'high', 'critical'])
export const TaskTypeSchema = z.enum(['feature', 'bug', 'improvement', 'chore'])
export const TaskSectionSchema = z.enum(['active', 'backlog', 'previously_active'])
export const HarnessLevelSchema = z.enum(['H0', 'H1', 'H2', 'H3'])
export const HarnessKindSchema = z.enum([
  'bug',
  'feature',
  'refactor',
  'docs',
  'chore',
  'security',
  'unknown',
])
export const HarnessRiskSchema = z.enum(['low', 'medium', 'high'])
export const HarnessEvidenceSchema = z.enum([
  'regression-test',
  'focused-tests',
  'docs-if-public-behavior',
  'config-preservation',
  'spec-or-design',
  'edge-cases',
  'scope-check',
])
export const HarnessGateSchema = z.enum([
  'verify-before-done',
  'scope-check',
  'review-before-ship',
  'spec-before-implementation',
])
const TaskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'blocked',
  'paused',
  'failed',
  'skipped',
])
// Subtask summary for context handoff between agents
export const SubtaskSummarySchema = z.object({
  title: z.string(),
  description: z.string(),
  filesChanged: z.array(
    z.object({
      path: z.string(),
      action: z.enum(['created', 'modified', 'deleted']),
    })
  ),
  whatWasDone: z.array(z.string()).min(1),
  outputForNextAgent: z.string().min(1),
  notes: z.string().optional(),
})

// Schema for validating completion data before persisting
// Used by completeSubtask() to enforce mandatory handoff
export const SubtaskCompletionDataSchema = z.object({
  output: z.string().min(1, 'Subtask output is required'),
  summary: SubtaskSummarySchema,
})

// Subtask schema for task fragmentation
export const SubtaskSchema = z.object({
  id: z.string(), // subtask-xxx
  description: z.string(),
  domain: z.string(), // frontend, backend, database, testing, etc.
  agent: z.string(), // agent file name (e.g., "frontend.md")
  status: TaskStatusSchema,
  dependsOn: z.array(z.string()), // IDs of dependent subtasks
  startedAt: z.string().optional(), // ISO8601
  completedAt: z.string().optional(), // ISO8601
  output: z.string().optional(), // Brief output description
  summary: SubtaskSummarySchema.optional(), // Full summary for context handoff
  skipReason: z.string().optional(), // Why this subtask was skipped
  blockReason: z.string().optional(), // What is blocking this subtask
  // Fibonacci estimation
  estimatedPoints: z.number().optional(), // Fibonacci: 1,2,3,5,8,13,21
  estimatedMinutes: z.number().optional(), // Derived from points
})

// Subtask progress tracking
const SubtaskProgressSchema = z.object({
  completed: z.number(),
  total: z.number(),
  percentage: z.number(),
})

export const TaskHarnessSchema = z.object({
  level: HarnessLevelSchema,
  kind: HarnessKindSchema,
  risk: HarnessRiskSchema,
  expectedEvidence: z.array(HarnessEvidenceSchema),
  scopeHints: z.array(z.string()),
  gates: z.array(HarnessGateSchema),
  rationale: z.string(),
  createdAt: z.string(),
})

export const CurrentTaskSchema = z.object({
  id: z.string(), // task_xxxxxxxx
  description: z.string(),
  type: TaskTypeSchema.optional(), // feature, bug, improvement, chore
  startedAt: z.string(), // ISO8601
  sessionId: z.string(), // sess_xxxxxxxx
  featureId: z.string().optional(), // feat_xxxxxxxx
  // Subtask tracking for fragmented tasks
  subtasks: z.array(SubtaskSchema).optional(),
  currentSubtaskIndex: z.number().optional(),
  subtaskProgress: SubtaskProgressSchema.optional(),
  // Linear integration - bidirectional sync
  linearId: z.string().optional(), // "PRJ-123" - Linear identifier
  linearUuid: z.string().optional(), // Linear internal UUID for API calls
  // SDD: linkage to a `prjct spec`. Ship reads this and surfaces the
  // spec's acceptance_criteria as a checklist in the PR description.
  linkedSpecId: z.string().optional(),
  // Fibonacci estimation
  estimatedPoints: z.number().optional(), // Fibonacci: 1,2,3,5,8,13,21
  estimatedMinutes: z.number().optional(), // Derived from points
  // Model specification - which AI model was used (PRJ-265)
  modelMetadata: ModelMetadataSchema.optional(),
  // Token usage tracking (input + output)
  tokensIn: z.number().optional(), // Total input tokens consumed
  tokensOut: z.number().optional(), // Total output tokens generated
  // Extended properties populated during task lifecycle
  parentDescription: z.string().optional(), // Original parent task description
  branch: z.string().optional(), // Git branch used for this task
  prUrl: z.string().optional(), // PR URL if shipped
  // Transparent auto-harness: created on task start so agents get the expected
  // evidence/gates without the user running another command.
  harness: TaskHarnessSchema.optional(),
  // Loop control: turns the agent has spent on THIS cycle. Incremented once per
  // UserPromptSubmit; resets when a new cycle starts. Drives the stuck-loop
  // escalation in the per-turn state block so a weak rig doesn't grind forever.
  turnCount: z.number().optional(),
  // Hard loop guard: when set, the human has consciously lifted the
  // maxTurnsPerCycle block (`prjct work --extend`) for THIS cycle, so the gate
  // stops firing until a new cycle resets it.
  turnLimitAcknowledgedAt: z.string().optional(),
})

export const PreviousTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: z.literal('paused'),
  startedAt: z.string(), // ISO8601
  pausedAt: z.string(), // ISO8601
  pauseReason: z.string().optional(),
  // Business metadata preserved across pause/resume (PRJ-344)
  type: TaskTypeSchema.optional(),
  sessionId: z.string().optional(),
  featureId: z.string().optional(),
  subtasks: z.array(SubtaskSchema).optional(),
  currentSubtaskIndex: z.number().optional(),
  subtaskProgress: SubtaskProgressSchema.optional(),
  linearId: z.string().optional(),
  linearUuid: z.string().optional(),
  estimatedPoints: z.number().optional(),
  estimatedMinutes: z.number().optional(),
  modelMetadata: ModelMetadataSchema.optional(),
  // Token usage tracking preserved across pause/resume
  tokensIn: z.number().optional(),
  tokensOut: z.number().optional(),
  harness: TaskHarnessSchema.optional(),
})

// Task feedback captured during completion (PRJ-272)
// Enables the task-to-analysis feedback loop: tasks report discoveries back to analysis
export const TaskFeedbackSchema = z.object({
  // Stack confirmations - tech confirmed/used during the task
  stackConfirmed: z.array(z.string()).optional(), // ["React 18", "TypeScript strict mode"]
  // Patterns discovered during the task
  patternsDiscovered: z.array(z.string()).optional(), // ["API routes follow /api/v1/{resource}"]
  // Agent accuracy - how well domain agents performed
  agentAccuracy: z
    .array(
      z.object({
        agent: z.string(), // "backend.md"
        rating: z.enum(['helpful', 'neutral', 'inaccurate']),
        note: z.string().optional(), // "Missing Tailwind context"
      })
    )
    .optional(),
  // Issues encountered during the task
  issuesEncountered: z.array(z.string()).optional(), // ["ESLint conflicts with Prettier"]
})

// Task history entry for completed tasks
// Stores historical context to enable pattern learning and cross-task correlation
export const TaskHistoryEntrySchema = z.object({
  taskId: z.string(), // task UUID
  title: z.string(), // parent task description
  classification: TaskTypeSchema, // feature, bug, improvement, chore
  startedAt: z.string(), // ISO8601
  completedAt: z.string(), // ISO8601
  subtaskCount: z.number(), // total number of subtasks
  subtaskSummaries: z.array(SubtaskSummarySchema), // summary of each subtask
  outcome: z.string(), // brief description of what was accomplished
  branchName: z.string(), // git branch used
  linearId: z.string().optional(), // Linear issue ID if linked
  linearUuid: z.string().optional(), // Linear internal UUID
  prUrl: z.string().optional(), // PR URL if shipped
  feedback: TaskFeedbackSchema.optional(), // Task-to-analysis feedback (PRJ-272)
  harness: TaskHarnessSchema.optional(), // Auto-harness contract active during the task
  // Token usage totals at completion
  tokensIn: z.number().optional(), // Total input tokens consumed
  tokensOut: z.number().optional(), // Total output tokens generated
})

// Workspace-scoped task for multi-agent parallel sessions
// Extends CurrentTask with workspace isolation fields
export const WorkspaceTaskSchema = CurrentTaskSchema.extend({
  workspaceId: z.string(), // UUID or worktree path hash
  worktreePath: z.string().optional(), // null = main worktree
  agentSessionId: z.string().optional(), // binding to specific agent session
  // Issue tracker binding (linearId already in CurrentTask)
  jiraId: z.string().optional(), // Jira issue key (PROJ-123)
  jiraUuid: z.string().optional(), // Jira issue UUID
  dispatchedFrom: z.string().optional(), // "linear-sprint" | "jira-backlog" | "manual"
})

export const StateJsonSchema = z.object({
  currentTask: CurrentTaskSchema.nullable(),
  previousTask: PreviousTaskSchema.nullable().optional(),
  pausedTasks: z.array(PreviousTaskSchema).optional(), // replaces previousTask
  taskHistory: z.array(TaskHistoryEntrySchema).optional(), // completed tasks history (max 20)
  activeTasks: z.array(WorkspaceTaskSchema).optional(), // parallel workspace tasks
  lastUpdated: z.string(),
})

export const QueueTaskSchema = z.object({
  id: z.string(), // task_xxxxxxxx
  description: z.string(),
  body: z.string().optional(), // markdown description
  priority: PrioritySchema,
  type: TaskTypeSchema, // detect from emoji 🐛=bug
  featureId: z.string().optional(),
  originFeature: z.string().optional(),
  completed: z.boolean(),
  completedAt: z.string().optional(),
  createdAt: z.string(), // ISO8601
  section: TaskSectionSchema,
  // Additional fields for ZERO DATA LOSS
  agent: z.string().optional(), // "fe", "be", "fe + be"
  groupName: z.string().optional(), // "Sales Reports", "Stock Audits"
  groupId: z.string().optional(), // For grouping related tasks
})

export const QueueJsonSchema = z.object({
  tasks: z.array(QueueTaskSchema),
  lastUpdated: z.string(),
})

// Inferred Types - Backward Compatible

export type Priority = z.infer<typeof PrioritySchema>
export type TaskType = z.infer<typeof TaskTypeSchema>
export type TaskSection = z.infer<typeof TaskSectionSchema>
export type HarnessLevel = z.infer<typeof HarnessLevelSchema>
export type HarnessKind = z.infer<typeof HarnessKindSchema>
export type HarnessRisk = z.infer<typeof HarnessRiskSchema>
export type HarnessEvidence = z.infer<typeof HarnessEvidenceSchema>
export type HarnessGate = z.infer<typeof HarnessGateSchema>
export type TaskHarness = z.infer<typeof TaskHarnessSchema>

export type Subtask = z.infer<typeof SubtaskSchema>
export type SubtaskCompletionData = z.infer<typeof SubtaskCompletionDataSchema>

export type CurrentTask = z.infer<typeof CurrentTaskSchema>
export type WorkspaceTask = z.infer<typeof WorkspaceTaskSchema>
export type PreviousTask = z.infer<typeof PreviousTaskSchema>
export type TaskFeedback = z.infer<typeof TaskFeedbackSchema>
export type TaskHistoryEntry = z.infer<typeof TaskHistoryEntrySchema>
export type StateJson = z.infer<typeof StateJsonSchema>
export type QueueTask = z.infer<typeof QueueTaskSchema>
export type QueueJson = z.infer<typeof QueueJsonSchema>

// Validation Helpers

/** Validate subtask completion data — returns errors or null */
export const validateSubtaskCompletion = (
  data: unknown
): { success: true; data: SubtaskCompletionData } | { success: false; errors: string[] } => {
  const result = SubtaskCompletionDataSchema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  return {
    success: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  }
}
