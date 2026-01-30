/**
 * Error Messages Catalog
 *
 * Centralized error messages with context and recovery hints.
 * Provides consistent, helpful error output across the CLI.
 *
 * @see PRJ-131
 * @module utils/error-messages
 */

export interface ErrorWithHint {
  message: string
  hint?: string
  file?: string
  docs?: string
  code?: string
}

/**
 * Common error messages with recovery hints
 */
export const ERRORS = {
  // Project errors
  NO_PROJECT: {
    message: 'No prjct project found in this directory',
    hint: "Run 'prjct init' to set up a new project",
    file: '.prjct/prjct.config.json',
  },

  NO_PROJECT_ID: {
    message: 'Project ID not found',
    hint: "Run 'prjct init' or check .prjct/prjct.config.json",
    file: '.prjct/prjct.config.json',
  },

  CONFIG_NOT_FOUND: {
    message: 'Configuration file not found',
    hint: "Run 'prjct init' to create project configuration",
    file: '.prjct/prjct.config.json',
  },

  CONFIG_INVALID: {
    message: 'Invalid configuration file',
    hint: 'Check JSON syntax or delete .prjct/ and run init again',
    file: '.prjct/prjct.config.json',
  },

  // Git errors
  GIT_NOT_FOUND: {
    message: 'Git repository not detected',
    hint: "Run 'git init' first, then 'prjct init'",
  },

  GIT_NO_COMMITS: {
    message: 'No commits in repository',
    hint: 'Make an initial commit before using prjct',
  },

  GIT_DIRTY: {
    message: 'Working directory has uncommitted changes',
    hint: "Commit or stash changes, or use '--force' to override",
  },

  GIT_ON_MAIN: {
    message: 'Cannot ship from main/master branch',
    hint: 'Create a feature branch first: git checkout -b feature/your-feature',
  },

  GIT_OPERATION_FAILED: {
    message: 'Git operation failed',
    hint: 'Check git status and resolve any conflicts',
  },

  // Auth errors
  GH_NOT_AUTHENTICATED: {
    message: 'GitHub CLI not authenticated',
    hint: "Run 'gh auth login' to authenticate",
    docs: 'https://cli.github.com/manual/gh_auth_login',
  },

  LINEAR_NOT_CONFIGURED: {
    message: 'Linear integration not configured',
    hint: "Run 'p. linear setup' to configure Linear",
  },

  LINEAR_API_ERROR: {
    message: 'Linear API error',
    hint: 'Check your API key or network connection',
  },

  // Task errors
  NO_ACTIVE_TASK: {
    message: 'No active task',
    hint: 'Start a task with \'p. task "description"\'',
  },

  TASK_ALREADY_ACTIVE: {
    message: 'A task is already in progress',
    hint: "Complete it with 'p. done' or pause with 'p. pause'",
  },

  // Sync errors
  SYNC_FAILED: {
    message: 'Project sync failed',
    hint: 'Check file permissions and try again',
  },

  // Ship errors
  NOTHING_TO_SHIP: {
    message: 'Nothing to ship',
    hint: 'Make some changes first, then run ship',
  },

  PR_CREATE_FAILED: {
    message: 'Failed to create pull request',
    hint: 'Check GitHub auth and remote configuration',
  },

  // Provider errors
  NO_AI_PROVIDER: {
    message: 'No AI provider detected',
    hint: "Install Claude Code or Gemini CLI, then run 'prjct start'",
    docs: 'https://prjct.app/docs',
  },

  PROVIDER_NOT_CONFIGURED: {
    message: 'AI provider not configured for prjct',
    hint: "Run 'prjct start' to configure your provider",
  },

  // Generic
  UNKNOWN: {
    message: 'An unexpected error occurred',
    hint: 'Check the error details and try again',
  },
} as const

export type ErrorCode = keyof typeof ERRORS

/**
 * Get error with optional overrides
 */
export function getError(code: ErrorCode, overrides?: Partial<ErrorWithHint>): ErrorWithHint {
  const base = ERRORS[code]
  return { ...base, ...overrides }
}

/**
 * Create a custom error with hint
 */
export function createError(
  message: string,
  hint?: string,
  options?: { file?: string; docs?: string }
): ErrorWithHint {
  return {
    message,
    hint,
    ...options,
  }
}
