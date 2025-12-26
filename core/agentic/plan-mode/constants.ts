/**
 * Plan Mode Constants
 */

/**
 * Commands that require planning mode
 */
export const PLAN_REQUIRED_COMMANDS = [
  'feature', // New features need planning
  'spec', // Specs are planning by definition
  'design', // Architecture needs planning
  'refactor', // Refactoring needs impact analysis
  'migrate', // Migrations are high-risk
]

/**
 * Commands that are destructive and need approval
 */
export const DESTRUCTIVE_COMMANDS = [
  'ship', // Commits and pushes
  'cleanup', // Deletes files/code
  'git', // Git operations
  'migrate', // Database/schema changes
]

/**
 * Read-only tools allowed in planning mode
 */
export const PLANNING_TOOLS = ['Read', 'Glob', 'Grep', 'GetTimestamp', 'GetDate', 'GetDateTime']

/**
 * Plan status enum - values must match PlanStatus type in types.ts
 */
export const PLAN_STATUS = {
  GATHERING: 'gathering',
  ANALYZING: 'analyzing',
  PROPOSING: 'proposing',
  PENDING_APPROVAL: 'awaiting_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  ABORTED: 'aborted',
} as const

export type PlanStatusValue = (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS]
