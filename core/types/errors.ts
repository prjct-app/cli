/**
 * Error Types and Catalog
 * ErrorWithHint, ErrorCode, and ERRORS catalog.
 */

export interface ErrorWithHint {
  message: string
  hint?: string
  file?: string
  docs?: string
  code?: string
}

export const ERRORS = {
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
  GH_NOT_AUTHENTICATED: {
    message: 'GitHub CLI not authenticated',
    hint: "Run 'gh auth login' to authenticate",
    docs: 'https://cli.github.com/manual/gh_auth_login',
  },
  LINEAR_NOT_CONFIGURED: {
    message: 'Linear integration not configured',
    hint: 'Configure the Linear MCP server in your AI client',
  },
  LINEAR_API_ERROR: {
    message: 'Linear API error',
    hint: 'Check your API key or network connection',
  },
  NO_ACTIVE_TASK: {
    message: 'No active task',
    hint: 'Start a task with \'p. task "description"\'',
  },
  TASK_ALREADY_ACTIVE: {
    message: 'A task is already in progress',
    hint: "Use 'p. status done' to complete it or 'p. status paused' to pause it",
  },
  SYNC_FAILED: {
    message: 'Project sync failed',
    hint: 'Check file permissions and try again',
  },
  NOTHING_TO_SHIP: {
    message: 'Nothing to ship',
    hint: 'Make some changes first, then run ship',
  },
  PR_CREATE_FAILED: {
    message: 'Failed to create pull request',
    hint: 'Check GitHub auth and remote configuration',
  },
  NO_AI_PROVIDER: {
    message: 'No AI provider detected',
    hint: "Install Claude Code or Gemini CLI, then run 'prjct start'",
    docs: 'https://prjct.app/docs',
  },
  PROVIDER_NOT_CONFIGURED: {
    message: 'AI provider not configured for prjct',
    hint: "Run 'prjct start' to configure your provider",
  },
  UNKNOWN_COMMAND: {
    message: 'Unknown command',
    hint: "Run 'prjct --help' to see available commands",
  },
  MISSING_PARAM: {
    message: 'Missing required parameter',
    hint: 'Check command usage below',
  },
  UNKNOWN: {
    message: 'An unexpected error occurred',
    hint: 'Check the error details and try again',
  },
} as const

export type ErrorCode = keyof typeof ERRORS
