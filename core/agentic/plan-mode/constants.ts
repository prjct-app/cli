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
 * Plan status enum
 */
export const PLAN_STATUS = {
  GATHERING: 'gathering', // Collecting information
  ANALYZING: 'analyzing', // Understanding context
  PROPOSING: 'proposing', // Generating plan
  PENDING_APPROVAL: 'pending', // Waiting for user
  APPROVED: 'approved', // User approved
  REJECTED: 'rejected', // User rejected
  EXECUTING: 'executing', // Running the plan
  COMPLETED: 'completed', // Done
  ABORTED: 'aborted', // User stopped mid-execution
}
