/**
 * Constants
 * Single source of truth for all constants in prjct-cli.
 */

// =============================================================================
// File Format Constants
// =============================================================================

/**
 * NOW file format patterns.
 */
export const NOW = {
  /** Header marker for NOW file */
  HEADER: '# NOW',

  /** Pattern to extract task from NOW content */
  TASK_PATTERN: /\*\*(.+?)\*\*/,

  /** Generate NOW file content */
  content: (task: string, startedAt: string, agent?: string, confidence?: number): string => {
    const lines = ['# NOW', '', `**${task}**`, '', `Started: ${startedAt}`]
    if (agent) {
      lines.push(
        `Agent: ${agent}${confidence ? ` (${Math.round(confidence * 100)}% confidence)` : ''}`
      )
    }
    return `${lines.join('\n')}\n`
  },

  /** Extract task from NOW content */
  extractTask: (content: string): string | null => {
    const match = content.match(NOW.TASK_PATTERN)
    return match ? match[1] : null
  },
} as const

/**
 * SHIPPED file format patterns.
 */
export const SHIPPED = {
  /** Header marker for SHIPPED file */
  HEADER: '# SHIPPED',

  /** Generate ship entry */
  entry: (feature: string, date: string, duration?: string): string => {
    const lines = [`## ${feature}`, '', `Shipped: ${date}`]
    if (duration) {
      lines.push(`Duration: ${duration}`)
    }
    return `${lines.join('\n')}\n\n`
  },
} as const

/**
 * NEXT file format patterns.
 */
export const NEXT = {
  /** Header marker for NEXT file */
  HEADER: '# NEXT',

  /** Pattern for task entries */
  TASK_PATTERN: /^[-*]\s+\[([x ])\]\s+(.+)$/gm,

  /** Generate task entry */
  entry: (task: string, completed: boolean = false): string => {
    return `- [${completed ? 'x' : ' '}] ${task}\n`
  },
} as const

/**
 * IDEAS file format patterns.
 */
export const IDEAS = {
  /** Header marker for IDEAS file */
  HEADER: '# IDEAS',

  /** Generate idea entry */
  entry: (idea: string, date: string): string => {
    return `- ${idea} _(${date})_\n`
  },
} as const

/**
 * Roadmap status markers.
 */
export const ROADMAP_STATUS = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  BLOCKED: 'Blocked',
} as const

export type RoadmapStatusKey = keyof typeof ROADMAP_STATUS

/**
 * ROADMAP file format patterns.
 */
export const ROADMAP = {
  /** Header marker for ROADMAP file */
  HEADER: '# ROADMAP',

  /** Status markers (re-exported for convenience) */
  STATUS: ROADMAP_STATUS,

  /** Generate feature entry */
  entry: (feature: string, status: RoadmapStatusKey, tasks?: string[]): string => {
    const lines = [`## ${feature}`, '', `Status: ${ROADMAP_STATUS[status]}`]
    if (tasks && tasks.length > 0) {
      lines.push('', '### Tasks', '')
      for (const task of tasks) {
        lines.push(`- [ ] ${task}`)
      }
    }
    return `${lines.join('\n')}\n\n`
  },
} as const

/**
 * Session file paths.
 */
export const SESSION = {
  /** Date format for session directories */
  DATE_FORMAT: 'YYYY-MM-DD',

  /** Generate session path */
  path: (year: string, month: string, day: string): string => {
    return `sessions/${year}-${month}/${year}-${month}-${day}`
  },

  /** Session metadata filename */
  METADATA_FILE: 'session-meta.json',

  /** Context log filename */
  CONTEXT_FILE: 'context.jsonl',
} as const

// =============================================================================
// Status & Priority Constants
// =============================================================================

/**
 * Status values used throughout prjct.
 */
export const STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
  PAUSED: 'paused',
} as const

export type Status = (typeof STATUS)[keyof typeof STATUS]

/**
 * Priority levels.
 */
export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY]

// =============================================================================
// Plan Mode Constants
// =============================================================================

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

/**
 * Commands that require planning mode
 */
export const PLAN_REQUIRED_COMMANDS = [
  'feature', // New features need planning
  'spec', // Specs are planning by definition
  'design', // Architecture needs planning
  'refactor', // Refactoring needs impact analysis
  'migrate', // Migrations are high-risk
] as const

/**
 * Commands that are destructive and need approval
 */
export const DESTRUCTIVE_COMMANDS = [
  'ship', // Commits and pushes
  'cleanup', // Deletes files/code
  'git', // Git operations
  'migrate', // Database/schema changes
] as const

/**
 * Read-only tools allowed in planning mode
 */
export const PLANNING_TOOLS = [
  'Read',
  'Glob',
  'Grep',
  'GetTimestamp',
  'GetDate',
  'GetDateTime',
] as const

// =============================================================================
// Timeout Constants (PRJ-111)
// =============================================================================

/**
 * Timeout values in milliseconds for various operations.
 * Can be overridden via PRJCT_TIMEOUT_* environment variables.
 */
export const TIMEOUTS = {
  /** Tool availability checks (git --version, npm --version) */
  TOOL_CHECK: 5_000,

  /** Standard git operations (status, add, commit) */
  GIT_OPERATION: 10_000,

  /** Git clone with --depth 1 */
  GIT_CLONE: 60_000,

  /** HTTP fetch/API requests */
  API_REQUEST: 30_000,

  /** npm install -g (CLI installation) - 2 minutes */
  NPM_INSTALL: 120_000,

  /** User-defined workflow hooks */
  WORKFLOW_HOOK: 60_000,
} as const

export type TimeoutKey = keyof typeof TIMEOUTS

/**
 * Get timeout value with optional environment variable override.
 * Environment variables: PRJCT_TIMEOUT_TOOL_CHECK, PRJCT_TIMEOUT_GIT_OPERATION, etc.
 */
export function getTimeout(key: TimeoutKey): number {
  const envVar = `PRJCT_TIMEOUT_${key}`
  const envValue = process.env[envVar]
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return TIMEOUTS[key]
}

// =============================================================================
// Output Limits (PRJ-71)
// =============================================================================

/**
 * Truncation lengths for CLI output messages.
 * Centralizes magic numbers from output.ts.
 */
export const OUTPUT_LIMITS = {
  /** Spinner message truncation */
  SPINNER_MSG: 45,
  /** Done/success message truncation */
  DONE_MSG: 50,
  /** Fail message truncation */
  FAIL_MSG: 65,
  /** Warn message truncation */
  WARN_MSG: 65,
  /** Step counter message truncation */
  STEP_MSG: 35,
  /** Progress bar text truncation */
  PROGRESS_TEXT: 25,
  /** Issue title truncation in lists */
  ISSUE_TITLE: 50,
  /** Fallback truncation when tier config is 0 */
  FALLBACK_TRUNCATE: 50,
  /** Terminal clear width */
  CLEAR_WIDTH: 80,
} as const

// =============================================================================
// Storage Limits (PRJ-71)
// =============================================================================

/**
 * File size and line limits for JSONL/storage operations.
 * Centralizes magic numbers from jsonl-helper.ts.
 */
export const STORAGE_LIMITS = {
  /** Default max lines for streaming JSONL reads */
  JSONL_MAX_LINES: 1000,
  /** File rotation threshold in MB */
  ROTATION_SIZE_MB: 10,
  /** Warning threshold for large files in MB */
  LARGE_FILE_WARN_MB: 50,
} as const

// =============================================================================
// Event Bus Limits (PRJ-71)
// =============================================================================

/**
 * Event bus configuration limits.
 * Centralizes magic numbers from bus.ts.
 */
export const EVENT_LIMITS = {
  /** Max events kept in history */
  HISTORY_MAX: 100,
} as const

// =============================================================================
// Workflow Help Strings (user-facing, no magic strings)
// =============================================================================

/**
 * Example commands shown in workflow preferences help.
 * Keeps UI copy in English and centralized.
 */
export const WORKFLOW_HELP = {
  /** Message when no workflow preferences are configured */
  NO_PREFERENCES: 'No workflow preferences configured.',
  /** Example: set a before-ship hook to run tests */
  SET_EXAMPLE: 'p. workflow before ship run the tests',
  /** Example: modify workflow to run npm test */
  MODIFY_EXAMPLE: 'p. workflow before ship run npm test',
  /** Example: remove the ship hook */
  REMOVE_EXAMPLE: 'p. workflow remove the ship hook',
} as const

// =============================================================================
// Combined Exports
// =============================================================================

/**
 * Combined file format exports for easy import.
 */
export const FORMATS = {
  NOW,
  SHIPPED,
  NEXT,
  IDEAS,
  ROADMAP,
  SESSION,
  STATUS,
  PRIORITY,
} as const

/**
 * Combined plan mode exports for easy import.
 */
export const PLAN = {
  STATUS: PLAN_STATUS,
  REQUIRED_COMMANDS: PLAN_REQUIRED_COMMANDS,
  DESTRUCTIVE_COMMANDS,
  TOOLS: PLANNING_TOOLS,
} as const

/**
 * Combined timeout exports for easy import.
 */
export const TIMEOUT = {
  VALUES: TIMEOUTS,
  get: getTimeout,
} as const
