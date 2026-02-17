/**
 * Issue Tracker Abstraction Types
 * Unified interface for Linear, Jira, Monday, and other issue trackers.
 */

// =============================================================================
// Core Issue Types
// =============================================================================

/**
 * Normalized issue from any tracker
 */
export interface Issue {
  id: string
  externalId: string // Original ID from provider (e.g., "ENG-123")
  provider: IssueProvider
  title: string
  description?: string
  status: IssueStatus
  priority: IssuePriority
  type: IssueType
  assignee?: {
    id: string
    name: string
    email?: string
  }
  labels: string[]
  project?: {
    id: string
    name: string
  }
  team?: {
    id: string
    name: string
    key?: string
  }
  /** Active sprint this issue belongs to (Jira only) */
  sprint?: {
    id: string
    name: string
    state?: 'active' | 'closed' | 'future'
    startDate?: string
    endDate?: string
  }
  /** Board this issue is on (Jira only) */
  board?: {
    id: string
    name: string
  }
  url: string
  createdAt: string
  updatedAt: string
  // Original data from provider
  raw?: unknown
}

/**
 * Enriched issue with AI-generated context
 */
export interface EnrichedIssue extends Issue {
  enrichment: {
    description: string // Enhanced description
    acceptanceCriteria: string[] // Generated ACs
    affectedFiles: string[] // Files likely to change
    technicalNotes: string // Implementation hints
    estimatedComplexity: 'trivial' | 'small' | 'medium' | 'large' | 'epic'
    suggestedApproach?: string // High-level approach
    relatedCode?: {
      file: string
      relevance: string
    }[]
    generatedAt: string
  }
}

/**
 * Input for creating issues
 */
export interface CreateIssueInput {
  title: string
  description?: string
  priority?: IssuePriority
  type?: IssueType
  labels?: string[]
  projectId?: string
  teamId?: string
  assigneeId?: string
}

/**
 * Update input for issues
 */
export interface UpdateIssueInput {
  title?: string
  description?: string
  priority?: IssuePriority
  assigneeId?: string | null // null to unassign
  stateId?: string
  projectId?: string
  labels?: string[]
  // Provider-specific: may update custom fields for AC, etc.
  customFields?: Record<string, unknown>
}

// =============================================================================
// Enums
// =============================================================================

export type IssueProvider = 'linear' | 'jira' | 'monday' | 'github' | 'asana' | 'none'

export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'

export type IssuePriority = 'none' | 'urgent' | 'high' | 'medium' | 'low'

export type IssueType = 'feature' | 'bug' | 'improvement' | 'task' | 'chore' | 'epic'

// =============================================================================
// Provider Interface
// =============================================================================

/**
 * Interface for issue tracker providers
 * Implement this for each provider (Linear, Jira, Monday, etc.)
 */
export interface IssueTrackerProvider {
  readonly name: IssueProvider
  readonly displayName: string

  /**
   * Check if provider is configured and ready
   */
  isConfigured(): boolean

  /**
   * Initialize the provider with config
   */
  initialize(config: IssueTrackerConfig): Promise<void>

  /**
   * Get issues assigned to current user
   */
  fetchAssignedIssues(options?: FetchOptions): Promise<Issue[]>

  /**
   * Get issues from a specific team/project
   */
  fetchTeamIssues(teamId: string, options?: FetchOptions): Promise<Issue[]>

  /**
   * Get a single issue by ID
   */
  fetchIssue(id: string): Promise<Issue | null>

  /**
   * Create a new issue
   */
  createIssue(input: CreateIssueInput): Promise<Issue>

  /**
   * Update an issue (for enrichment)
   */
  updateIssue(id: string, input: UpdateIssueInput): Promise<Issue>

  /**
   * Mark issue as in progress
   */
  markInProgress(id: string): Promise<void>

  /**
   * Mark issue as done/completed
   */
  markDone(id: string): Promise<void>

  /**
   * Get available teams
   */
  getTeams(): Promise<Array<{ id: string; name: string; key?: string }>>

  /**
   * Get available projects
   */
  getProjects(): Promise<Array<{ id: string; name: string }>>
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Base config for all providers
 */
export interface IssueTrackerConfig {
  enabled: boolean
  provider: IssueProvider
  // Authentication is handled via MCP OAuth in the AI client session.
  // Default team/project for new issues
  defaultTeamId?: string
  defaultProjectId?: string
  // Sync preferences
  syncOn: {
    task: boolean // Sync on p. task
    done: boolean // Sync on p. done
    ship: boolean // Sync on p. ship
  }
  // Enrichment settings
  enrichment: {
    enabled: boolean
    updateProvider: boolean // Push enriched description back to provider
  }
  // Metadata
  setupAt?: string
  lastSyncAt?: string
}

/**
 * Linear-specific config
 */
export interface LinearConfig extends IssueTrackerConfig {
  provider: 'linear'
  // Linear-specific settings
  teamKey?: string // e.g., "ENG"
}

/**
 * Jira-specific config (future)
 */
export interface JiraConfig extends IssueTrackerConfig {
  provider: 'jira'
  baseUrl: string // e.g., "https://company.atlassian.net"
  projectKey?: string
}

/**
 * Monday-specific config (future)
 */
export interface MondayConfig extends IssueTrackerConfig {
  provider: 'monday'
  boardId?: string
}

/**
 * GitHub Issues config (future)
 */
export interface GitHubConfig extends IssueTrackerConfig {
  provider: 'github'
  owner: string // e.g., "anthropics"
  repo: string // e.g., "claude-code"
}

// =============================================================================
// Fetch Options
// =============================================================================

export interface FetchOptions {
  limit?: number
  status?: IssueStatus[]
  includeCompleted?: boolean
  since?: string // ISO date

  /**
   * Scope filter - who's issues to fetch
   * Default: 'mine' (only issues assigned to current user)
   */
  scope?: 'mine' | 'team' | 'project' | 'unassigned'

  /**
   * Project filter (when scope is 'project')
   */
  projectId?: string

  /**
   * Team filter (when scope is 'team')
   */
  teamId?: string

  /**
   * Sprint scope filter (Jira only)
   * 'active'  — issues in the current active sprint
   * 'backlog' — issues not assigned to any sprint (backlog)
   * 'all'     — both sprint and backlog (default for fetchAssignedIssues)
   */
  sprintScope?: 'active' | 'backlog' | 'all'

  /**
   * Board ID filter (Jira only) — scope sprint/backlog to a specific board
   */
  boardId?: string
}

// =============================================================================
// Sync Result
// =============================================================================

export interface SyncResult {
  provider: IssueProvider
  fetched: number
  enriched: number
  updated: number
  errors: Array<{ issueId: string; error: string }>
  timestamp: string
}

// =============================================================================
// Default Configs
// =============================================================================

export const DEFAULT_LINEAR_CONFIG: LinearConfig = {
  enabled: false,
  provider: 'linear',
  syncOn: {
    task: true,
    done: true,
    ship: true,
  },
  enrichment: {
    enabled: true,
    updateProvider: true,
  },
}

export const DEFAULT_JIRA_CONFIG: JiraConfig = {
  enabled: false,
  provider: 'jira',
  baseUrl: '',
  syncOn: {
    task: true,
    done: true,
    ship: true,
  },
  enrichment: {
    enabled: true,
    updateProvider: true,
  },
}
