/**
 * JIRA MCP Adapter
 *
 * Provides JIRA integration via Atlassian's official MCP Server.
 * Used when API tokens are not available (e.g., corporate SSO environments).
 *
 * The MCP Server uses OAuth 2.1 via browser, compatible with corporate SSO.
 * See: https://www.atlassian.com/blog/announcements/remote-mcp-server
 *
 * Setup: Add to ~/.claude/mcp.json:
 * {
 *   "mcpServers": {
 *     "Atlassian": {
 *       "command": "npx",
 *       "args": ["-y", "mcp-remote@latest", "https://mcp.atlassian.com/v1/sse"]
 *     }
 *   }
 * }
 */

import type {
  IssueTrackerProvider,
  Issue,
  CreateIssueInput,
  UpdateIssueInput,
  FetchOptions,
  JiraConfig,
  IssueStatus,
  IssuePriority,
  IssueType,
} from '../issue-tracker/types'

// =============================================================================
// MCP Response Types (from Atlassian MCP Server)
// =============================================================================

interface MCPJiraIssue {
  id: string
  key: string
  fields: {
    summary: string
    description?: string
    status: {
      name: string
      statusCategory?: {
        key: string
      }
    }
    priority?: {
      name: string
    }
    issuetype: {
      name: string
    }
    assignee?: {
      accountId: string
      displayName: string
      emailAddress?: string
    }
    project: {
      id: string
      key: string
      name: string
    }
    labels?: string[]
    created: string
    updated: string
  }
}

// =============================================================================
// Status/Priority Mapping (same as REST client)
// =============================================================================

const JIRA_STATUS_CATEGORY_MAP: Record<string, IssueStatus> = {
  new: 'todo',
  indeterminate: 'in_progress',
  done: 'done',
}

const JIRA_STATUS_NAME_MAP: Record<string, IssueStatus> = {
  backlog: 'backlog',
  open: 'backlog',
  'to do': 'todo',
  todo: 'todo',
  new: 'todo',
  'in progress': 'in_progress',
  'in development': 'in_progress',
  'in review': 'in_review',
  'code review': 'in_review',
  review: 'in_review',
  done: 'done',
  closed: 'done',
  resolved: 'done',
  complete: 'done',
  completed: 'done',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  "won't do": 'cancelled',
  'wont do': 'cancelled',
  rejected: 'cancelled',
}

const JIRA_PRIORITY_MAP: Record<string, IssuePriority> = {
  highest: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
  lowest: 'low',
}

// =============================================================================
// MCP Instruction Generator
// =============================================================================

/**
 * Represents an MCP instruction for Claude to execute.
 * Instead of making direct API calls, we generate instructions
 * that Claude will execute using the Atlassian MCP tools.
 */
export interface MCPInstruction {
  tool: string
  params: Record<string, unknown>
  description: string
}

/**
 * Generate MCP instruction for searching JIRA issues
 */
export function createSearchInstruction(jql: string, maxResults = 50): MCPInstruction {
  return {
    tool: 'mcp__atlassian__jira_search_issues',
    params: {
      jql,
      maxResults,
    },
    description: `Search JIRA issues: ${jql}`,
  }
}

/**
 * Generate MCP instruction for fetching a single issue
 */
export function createGetIssueInstruction(issueKey: string): MCPInstruction {
  return {
    tool: 'mcp__atlassian__jira_get_issue',
    params: {
      issueKey,
    },
    description: `Get JIRA issue: ${issueKey}`,
  }
}

/**
 * Generate MCP instruction for transitioning an issue
 */
export function createTransitionInstruction(
  issueKey: string,
  transitionName: string
): MCPInstruction {
  return {
    tool: 'mcp__atlassian__jira_transition_issue',
    params: {
      issueKey,
      transitionName,
    },
    description: `Transition ${issueKey} to: ${transitionName}`,
  }
}

/**
 * Generate MCP instruction for updating an issue
 */
export function createUpdateInstruction(
  issueKey: string,
  fields: Record<string, unknown>
): MCPInstruction {
  return {
    tool: 'mcp__atlassian__jira_update_issue',
    params: {
      issueKey,
      fields,
    },
    description: `Update JIRA issue: ${issueKey}`,
  }
}

/**
 * Generate MCP instruction for creating an issue
 */
export function createCreateIssueInstruction(
  projectKey: string,
  issueType: string,
  summary: string,
  description?: string
): MCPInstruction {
  return {
    tool: 'mcp__atlassian__jira_create_issue',
    params: {
      projectKey,
      issueType,
      summary,
      description,
    },
    description: `Create JIRA issue in ${projectKey}: ${summary}`,
  }
}

// =============================================================================
// MCP Adapter Implementation
// =============================================================================

/**
 * JIRA MCP Adapter
 *
 * This adapter doesn't make direct API calls. Instead, it provides:
 * 1. MCPInstruction objects that Claude executes using MCP tools
 * 2. Mapping functions to convert MCP responses to normalized Issue types
 *
 * Usage in templates:
 * - Check if MCP mode is active
 * - Call adapter methods to get instructions
 * - Claude executes the MCP tools
 * - Parse results with mapMCPIssue()
 */
export class JiraMCPAdapter implements Partial<IssueTrackerProvider> {
  readonly name = 'jira' as const
  readonly displayName = 'JIRA (MCP)'

  private config: JiraConfig | null = null
  private baseUrl: string = ''

  /**
   * Check if adapter is ready (config loaded)
   */
  isConfigured(): boolean {
    return this.config?.enabled === true
  }

  /**
   * Initialize with config (no API verification needed - MCP handles auth)
   */
  async initialize(config: JiraConfig): Promise<void> {
    this.config = config
    this.baseUrl = config.baseUrl || ''
    console.log('[jira-mcp] Initialized MCP adapter')
  }

  /**
   * Get instruction to fetch assigned issues
   */
  getAssignedIssuesInstruction(options?: FetchOptions): MCPInstruction {
    const maxResults = options?.limit || 50
    const jql = options?.includeCompleted
      ? 'assignee = currentUser() ORDER BY updated DESC'
      : 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC'

    return createSearchInstruction(jql, maxResults)
  }

  /**
   * Get instruction to fetch team issues
   */
  getTeamIssuesInstruction(projectKey: string, options?: FetchOptions): MCPInstruction {
    const maxResults = options?.limit || 50
    const jql = options?.includeCompleted
      ? `project = ${projectKey} ORDER BY updated DESC`
      : `project = ${projectKey} AND statusCategory != Done ORDER BY updated DESC`

    return createSearchInstruction(jql, maxResults)
  }

  /**
   * Get instruction to fetch a single issue
   */
  getIssueInstruction(issueKey: string): MCPInstruction {
    return createGetIssueInstruction(issueKey)
  }

  /**
   * Get instruction to mark issue in progress
   */
  getMarkInProgressInstruction(issueKey: string): MCPInstruction {
    return createTransitionInstruction(issueKey, 'In Progress')
  }

  /**
   * Get instruction to mark issue done
   */
  getMarkDoneInstruction(issueKey: string): MCPInstruction {
    return createTransitionInstruction(issueKey, 'Done')
  }

  /**
   * Get instruction to update issue description
   */
  getUpdateDescriptionInstruction(issueKey: string, description: string): MCPInstruction {
    return createUpdateInstruction(issueKey, { description })
  }

  /**
   * Get instruction to create a new issue
   */
  getCreateIssueInstruction(input: CreateIssueInput): MCPInstruction {
    const projectKey = input.teamId || this.config?.projectKey
    if (!projectKey) {
      throw new Error('Project key required for creating issues')
    }

    return createCreateIssueInstruction(
      projectKey,
      this.mapTypeToJira(input.type),
      input.title,
      input.description
    )
  }

  /**
   * Map MCP response to normalized Issue
   */
  mapMCPIssue(mcpIssue: MCPJiraIssue): Issue {
    const statusName = mcpIssue.fields.status.name.toLowerCase()
    const statusCategory = mcpIssue.fields.status.statusCategory?.key || ''

    const status: IssueStatus =
      JIRA_STATUS_NAME_MAP[statusName] ||
      JIRA_STATUS_CATEGORY_MAP[statusCategory] ||
      'backlog'

    const priorityName = mcpIssue.fields.priority?.name?.toLowerCase() || 'medium'
    const priority: IssuePriority = JIRA_PRIORITY_MAP[priorityName] || 'medium'

    return {
      id: mcpIssue.id,
      externalId: mcpIssue.key,
      provider: 'jira',
      title: mcpIssue.fields.summary,
      description: mcpIssue.fields.description,
      status,
      priority,
      type: this.inferType(mcpIssue.fields.issuetype.name, mcpIssue.fields.labels || []),
      assignee: mcpIssue.fields.assignee
        ? {
            id: mcpIssue.fields.assignee.accountId,
            name: mcpIssue.fields.assignee.displayName,
            email: mcpIssue.fields.assignee.emailAddress,
          }
        : undefined,
      labels: mcpIssue.fields.labels || [],
      team: {
        id: mcpIssue.fields.project.id,
        name: mcpIssue.fields.project.name,
        key: mcpIssue.fields.project.key,
      },
      project: {
        id: mcpIssue.fields.project.id,
        name: mcpIssue.fields.project.name,
      },
      url: this.baseUrl
        ? `${this.baseUrl}/browse/${mcpIssue.key}`
        : `https://jira.atlassian.com/browse/${mcpIssue.key}`,
      createdAt: mcpIssue.fields.created,
      updatedAt: mcpIssue.fields.updated,
      raw: mcpIssue,
    }
  }

  /**
   * Map array of MCP issues
   */
  mapMCPIssues(mcpIssues: MCPJiraIssue[]): Issue[] {
    return mcpIssues.map((issue) => this.mapMCPIssue(issue))
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private inferType(issueTypeName: string, labels: string[]): IssueType {
    const typeLower = issueTypeName.toLowerCase()
    const labelsLower = labels.map((l) => l.toLowerCase())

    if (typeLower === 'bug' || labelsLower.includes('bug')) return 'bug'
    if (typeLower === 'story' || typeLower === 'feature' || labelsLower.includes('feature'))
      return 'feature'
    if (typeLower === 'improvement' || labelsLower.includes('improvement')) return 'improvement'
    if (typeLower === 'epic') return 'epic'
    if (typeLower === 'sub-task' || typeLower === 'subtask') return 'task'

    return 'task'
  }

  private mapTypeToJira(type?: IssueType): string {
    switch (type) {
      case 'bug':
        return 'Bug'
      case 'feature':
        return 'Story'
      case 'improvement':
        return 'Improvement'
      case 'epic':
        return 'Epic'
      case 'chore':
      case 'task':
      default:
        return 'Task'
    }
  }
}

// Singleton instance
export const jiraMCPAdapter = new JiraMCPAdapter()

// =============================================================================
// Utility: Check if MCP is available
// =============================================================================

/**
 * Check if Atlassian MCP tools are available in the current session.
 * This is determined by checking the MCP configuration.
 */
export function isMCPAvailable(): boolean {
  // In template context, Claude can detect available MCP tools
  // This function serves as documentation for the check
  // Actual detection happens in the template execution
  return true
}

/**
 * Get MCP setup instructions for users
 */
export function getMCPSetupInstructions(): string {
  return `
## JIRA MCP Setup

Add to ~/.claude/mcp.json:

\`\`\`json
{
  "mcpServers": {
    "Atlassian": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "https://mcp.atlassian.com/v1/sse"]
    }
  }
}
\`\`\`

Then restart Claude Code and authenticate via browser when prompted.
`.trim()
}
