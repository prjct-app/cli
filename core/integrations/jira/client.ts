/**
 * JIRA Client
 * Implements IssueTrackerProvider for Atlassian JIRA using REST API v3
 *
 * Authentication Methods:
 * 1. API Token (default): Direct REST API calls
 *    - JIRA_BASE_URL: Your JIRA instance (e.g., https://company.atlassian.net)
 *    - JIRA_EMAIL: Your Atlassian account email
 *    - JIRA_API_TOKEN: API token from https://id.atlassian.com/manage-profile/security/api-tokens
 *
 * 2. MCP Mode (for corporate SSO): Uses Atlassian's official MCP Server
 *    - No API token needed
 *    - Authenticates via browser (OAuth 2.1, SSO compatible)
 *    - Requires MCP server configured in ~/.claude/mcp.json
 */

import { getErrorMessage } from '../../types/fs'
import type { JiraAuthMode, JiraIssue, JiraProject, JiraSearchResponse } from '../../types/jira'
import type {
  CreateIssueInput,
  FetchOptions,
  Issue,
  IssuePriority,
  IssueStatus,
  IssueTrackerProvider,
  IssueType,
  JiraConfig,
  UpdateIssueInput,
} from '../issue-tracker/types'

// =============================================================================
// Status/Priority Mapping
// =============================================================================

/**
 * Map JIRA status categories to normalized status
 * JIRA uses statusCategory.key: 'new', 'indeterminate', 'done'
 */
const JIRA_STATUS_CATEGORY_MAP: Record<string, IssueStatus> = {
  new: 'todo',
  indeterminate: 'in_progress',
  done: 'done',
}

/**
 * Common JIRA status names to normalized status
 */
const JIRA_STATUS_NAME_MAP: Record<string, IssueStatus> = {
  // Backlog states
  backlog: 'backlog',
  open: 'backlog',
  'to do': 'todo',
  todo: 'todo',
  new: 'todo',

  // In Progress states
  'in progress': 'in_progress',
  'in development': 'in_progress',
  'in review': 'in_review',
  'code review': 'in_review',
  review: 'in_review',

  // Done states
  done: 'done',
  closed: 'done',
  resolved: 'done',
  complete: 'done',
  completed: 'done',

  // Cancelled states
  cancelled: 'cancelled',
  canceled: 'cancelled',
  "won't do": 'cancelled',
  'wont do': 'cancelled',
  rejected: 'cancelled',
}

/**
 * JIRA priorities: 1 = Highest, 5 = Lowest
 */
const JIRA_PRIORITY_MAP: Record<string, IssuePriority> = {
  highest: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
  lowest: 'low',
  // Numeric fallbacks
  '1': 'urgent',
  '2': 'high',
  '3': 'medium',
  '4': 'low',
  '5': 'low',
}

const PRIORITY_TO_JIRA: Record<IssuePriority, string> = {
  urgent: 'Highest',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'Medium',
}

export type { JiraAuthMode } from '../../types/jira'

// =============================================================================
// JIRA Provider Implementation
// =============================================================================

export class JiraProvider implements IssueTrackerProvider {
  readonly name = 'jira' as const
  readonly displayName = 'JIRA'

  private baseUrl: string = ''
  private auth: string = ''
  private config: JiraConfig | null = null
  private currentUser: { accountId: string; displayName: string; email?: string } | null = null
  private _authMode: JiraAuthMode = 'none'

  /**
   * Get current authentication mode
   */
  get authMode(): JiraAuthMode {
    return this._authMode
  }

  /**
   * Check if using MCP mode (no direct API access)
   */
  isMCPMode(): boolean {
    return this._authMode === 'mcp'
  }

  /**
   * Check if provider is configured
   * Returns true for both API token mode (ready to make calls)
   * and MCP mode (ready to generate instructions)
   */
  isConfigured(): boolean {
    if (this._authMode === 'mcp') {
      return this.config?.enabled === true
    }
    return this.baseUrl !== '' && this.auth !== '' && this.config?.enabled === true
  }

  /**
   * Initialize with config
   * Supports two modes:
   * 1. API Token mode: Direct REST API access (requires JIRA_API_TOKEN)
   * 2. MCP mode: Via Atlassian MCP Server (for corporate SSO)
   */
  async initialize(config: JiraConfig): Promise<void> {
    this.config = config

    // JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN: JIRA API credentials (fallback from config)
    const baseUrl = config.baseUrl || process.env.JIRA_BASE_URL
    const email = process.env.JIRA_EMAIL
    const apiToken = config.apiKey || process.env.JIRA_API_TOKEN

    // Check if we have API token credentials
    const hasApiCredentials = baseUrl && email && apiToken

    if (hasApiCredentials) {
      // API Token mode - direct REST API access
      this._authMode = 'api-token'

      // Normalize base URL (remove trailing slash)
      this.baseUrl = baseUrl!.replace(/\/$/, '')

      // Create Basic Auth header
      this.auth = Buffer.from(`${email}:${apiToken}`).toString('base64')

      // Verify connection by fetching current user
      try {
        const response = await this.request<{
          accountId: string
          displayName: string
          emailAddress?: string
        }>('/rest/api/3/myself')
        this.currentUser = {
          accountId: response.accountId,
          displayName: response.displayName,
          email: response.emailAddress,
        }
        console.log(
          `[jira] Connected as ${this.currentUser.displayName} (${this.currentUser.email || 'no email'})`
        )
      } catch (error) {
        this.baseUrl = ''
        this.auth = ''
        this._authMode = 'none'
        throw new Error(`JIRA connection failed: ${getErrorMessage(error)}`)
      }
    } else {
      // MCP mode - no direct API access, Claude uses MCP tools
      this._authMode = 'mcp'

      // Store base URL if provided (for generating issue URLs)
      if (baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '')
      }

      console.log('[jira] Initialized in MCP mode (no API token)')
      console.log('[jira] Claude will use Atlassian MCP tools for JIRA operations')

      // Log what's missing if user might want API mode
      if (!apiToken) {
        console.log('[jira] Tip: Set JIRA_API_TOKEN for direct API access')
      }
    }
  }

  /**
   * Get auth mode information for templates
   */
  getAuthInfo(): { mode: JiraAuthMode; baseUrl: string; user?: string } {
    return {
      mode: this._authMode,
      baseUrl: this.baseUrl,
      user: this.currentUser?.displayName,
    }
  }

  /**
   * Get issues assigned to current user
   */
  async fetchAssignedIssues(options?: FetchOptions): Promise<Issue[]> {
    if (!this.isConfigured()) throw new Error('JIRA not initialized')

    const maxResults = options?.limit || 50
    const jql = options?.includeCompleted
      ? 'assignee = currentUser() ORDER BY updated DESC'
      : 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC'

    const response = await this.request<JiraSearchResponse>(
      `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=*all`
    )

    return response.issues.map((issue) => this.mapIssue(issue))
  }

  /**
   * Get issues from a team/project
   */
  async fetchTeamIssues(projectKey: string, options?: FetchOptions): Promise<Issue[]> {
    if (!this.isConfigured()) throw new Error('JIRA not initialized')

    const maxResults = options?.limit || 50
    const jql = options?.includeCompleted
      ? `project = ${projectKey} ORDER BY updated DESC`
      : `project = ${projectKey} AND statusCategory != Done ORDER BY updated DESC`

    const response = await this.request<JiraSearchResponse>(
      `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=*all`
    )

    return response.issues.map((issue) => this.mapIssue(issue))
  }

  /**
   * Get a single issue by key (e.g., "ENG-123") or ID
   */
  async fetchIssue(id: string): Promise<Issue | null> {
    if (!this.isConfigured()) throw new Error('JIRA not initialized')

    try {
      const issue = await this.request<JiraIssue>(`/rest/api/3/issue/${id}?fields=*all`)
      return this.mapIssue(issue)
    } catch (error) {
      // Issue not found
      if (getErrorMessage(error).includes('404')) {
        return null
      }
      throw error
    }
  }

  /**
   * Create a new issue
   */
  async createIssue(input: CreateIssueInput): Promise<Issue> {
    if (!this.isConfigured()) throw new Error('JIRA not initialized')

    const projectKey = input.teamId || this.config?.projectKey || this.config?.defaultTeamId
    if (!projectKey) {
      throw new Error('Project key required for creating issues')
    }

    // Build issue payload
    const payload: Record<string, unknown> = {
      fields: {
        project: { key: projectKey },
        summary: input.title,
        issuetype: { name: this.mapTypeToJira(input.type) },
      },
    }

    // Add optional fields
    if (input.description) {
      ;(payload.fields as Record<string, unknown>).description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: input.description }],
          },
        ],
      }
    }

    if (input.priority) {
      ;(payload.fields as Record<string, unknown>).priority = {
        name: PRIORITY_TO_JIRA[input.priority],
      }
    }

    if (input.labels?.length) {
      ;(payload.fields as Record<string, unknown>).labels = input.labels
    }

    if (input.assigneeId) {
      ;(payload.fields as Record<string, unknown>).assignee = {
        accountId: input.assigneeId,
      }
    }

    const created = await this.request<{ id: string; key: string }>('/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    // Fetch the full issue
    const issue = await this.fetchIssue(created.key)
    if (!issue) {
      throw new Error('Failed to fetch created issue')
    }

    return issue
  }

  /**
   * Update an issue (for enrichment - updates description)
   */
  async updateIssue(id: string, input: UpdateIssueInput): Promise<Issue> {
    if (!this.isConfigured()) throw new Error('JIRA not initialized')

    const payload: Record<string, unknown> = { fields: {} }

    if (input.description) {
      ;(payload.fields as Record<string, unknown>).description = {
        type: 'doc',
        version: 1,
        content: this.markdownToADF(input.description),
      }
    }

    await this.request(`/rest/api/3/issue/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })

    // Fetch updated issue
    const updated = await this.fetchIssue(id)
    if (!updated) {
      throw new Error('Failed to fetch updated issue')
    }

    return updated
  }

  /**
   * Mark issue as in progress
   */
  async markInProgress(id: string): Promise<void> {
    if (!this.isConfigured()) throw new Error('JIRA not initialized')

    // Get available transitions
    const transitions = await this.request<{
      transitions: Array<{ id: string; name: string; to: { statusCategory: { key: string } } }>
    }>(`/rest/api/3/issue/${id}/transitions`)

    // Find transition to "in progress" state
    const inProgressTransition = transitions.transitions.find(
      (t) =>
        t.to.statusCategory.key === 'indeterminate' ||
        t.name.toLowerCase().includes('progress') ||
        t.name.toLowerCase().includes('start')
    )

    if (inProgressTransition) {
      await this.request(`/rest/api/3/issue/${id}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ transition: { id: inProgressTransition.id } }),
      })
    }
  }

  /**
   * Mark issue as done
   */
  async markDone(id: string): Promise<void> {
    if (!this.isConfigured()) throw new Error('JIRA not initialized')

    // Get available transitions
    const transitions = await this.request<{
      transitions: Array<{ id: string; name: string; to: { statusCategory: { key: string } } }>
    }>(`/rest/api/3/issue/${id}/transitions`)

    // Find transition to "done" state
    const doneTransition = transitions.transitions.find(
      (t) =>
        t.to.statusCategory.key === 'done' ||
        t.name.toLowerCase().includes('done') ||
        t.name.toLowerCase().includes('complete') ||
        t.name.toLowerCase().includes('resolve')
    )

    if (doneTransition) {
      await this.request(`/rest/api/3/issue/${id}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ transition: { id: doneTransition.id } }),
      })
    }
  }

  /**
   * Get available projects (teams in JIRA context)
   */
  async getTeams(): Promise<Array<{ id: string; name: string; key?: string }>> {
    if (!this.isConfigured()) throw new Error('JIRA not initialized')

    const projects = await this.request<JiraProject[]>('/rest/api/3/project')

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      key: project.key,
    }))
  }

  /**
   * Get available projects
   */
  async getProjects(): Promise<Array<{ id: string; name: string }>> {
    // In JIRA, teams = projects, so return same data
    return this.getTeams()
  }

  // =============================================================================
  // Private Helpers
  // =============================================================================

  /**
   * Make authenticated request to JIRA API
   */
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`JIRA API error ${response.status}: ${errorText}`)
    }

    // Handle empty responses (like successful PUT)
    const text = await response.text()
    if (!text) {
      return {} as T
    }

    return JSON.parse(text) as T
  }

  /**
   * Map JIRA issue to normalized Issue
   */
  private mapIssue(jiraIssue: JiraIssue): Issue {
    const statusName = jiraIssue.fields.status.name.toLowerCase()
    const statusCategory = jiraIssue.fields.status.statusCategory.key

    // Try exact status name match first, then category
    const status: IssueStatus =
      JIRA_STATUS_NAME_MAP[statusName] || JIRA_STATUS_CATEGORY_MAP[statusCategory] || 'backlog'

    const priorityName = jiraIssue.fields.priority?.name?.toLowerCase() || 'medium'
    const priority: IssuePriority = JIRA_PRIORITY_MAP[priorityName] || 'medium'

    return {
      id: jiraIssue.id,
      externalId: jiraIssue.key,
      provider: 'jira',
      title: jiraIssue.fields.summary,
      description: this.extractDescription(jiraIssue.fields.description),
      status,
      priority,
      type: this.inferType(jiraIssue.fields.issuetype.name, jiraIssue.fields.labels),
      assignee: jiraIssue.fields.assignee
        ? {
            id: jiraIssue.fields.assignee.accountId,
            name: jiraIssue.fields.assignee.displayName,
            email: jiraIssue.fields.assignee.emailAddress,
          }
        : undefined,
      labels: jiraIssue.fields.labels || [],
      team: {
        id: jiraIssue.fields.project.id,
        name: jiraIssue.fields.project.name,
        key: jiraIssue.fields.project.key,
      },
      project: {
        id: jiraIssue.fields.project.id,
        name: jiraIssue.fields.project.name,
      },
      url: `${this.baseUrl}/browse/${jiraIssue.key}`,
      createdAt: jiraIssue.fields.created,
      updatedAt: jiraIssue.fields.updated,
      raw: jiraIssue,
    }
  }

  /**
   * Extract plain text from JIRA description (ADF or string)
   */
  private extractDescription(description: JiraIssue['fields']['description']): string | undefined {
    if (!description) return undefined

    // Handle string descriptions (older JIRA versions)
    if (typeof description === 'string') {
      return description
    }

    // Handle ADF (Atlassian Document Format)
    try {
      const texts: string[] = []
      const extractText = (node: unknown): void => {
        if (!node || typeof node !== 'object') return
        const n = node as Record<string, unknown>

        if (n.type === 'text' && typeof n.text === 'string') {
          texts.push(n.text)
        }
        if (Array.isArray(n.content)) {
          n.content.forEach(extractText)
        }
      }

      if (Array.isArray(description.content)) {
        description.content.forEach(extractText)
      }

      return texts.join('\n') || undefined
    } catch (_error) {
      return undefined
    }
  }

  /**
   * Convert markdown to ADF (simplified)
   */
  private markdownToADF(markdown: string): Array<Record<string, unknown>> {
    const lines = markdown.split('\n')
    const content: Array<Record<string, unknown>> = []

    for (const line of lines) {
      if (line.startsWith('## ')) {
        // Heading 2
        content.push({
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: line.slice(3) }],
        })
      } else if (line.startsWith('### ')) {
        // Heading 3
        content.push({
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: line.slice(4) }],
        })
      } else if (line.startsWith('- [ ] ')) {
        // Checkbox unchecked
        content.push({
          type: 'taskList',
          attrs: { localId: crypto.randomUUID() },
          content: [
            {
              type: 'taskItem',
              attrs: { localId: crypto.randomUUID(), state: 'TODO' },
              content: [{ type: 'text', text: line.slice(6) }],
            },
          ],
        })
      } else if (line.startsWith('- [x] ')) {
        // Checkbox checked
        content.push({
          type: 'taskList',
          attrs: { localId: crypto.randomUUID() },
          content: [
            {
              type: 'taskItem',
              attrs: { localId: crypto.randomUUID(), state: 'DONE' },
              content: [{ type: 'text', text: line.slice(6) }],
            },
          ],
        })
      } else if (line.startsWith('- ')) {
        // Bullet point
        content.push({
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: line.slice(2) }],
                },
              ],
            },
          ],
        })
      } else if (line.trim()) {
        // Regular paragraph
        content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: line }],
        })
      }
    }

    return content
  }

  /**
   * Infer issue type from JIRA issue type and labels
   */
  private inferType(issueTypeName: string, labels: string[]): IssueType {
    const typeLower = issueTypeName.toLowerCase()
    const labelsLower = labels.map((l) => l.toLowerCase())

    if (typeLower === 'bug' || labelsLower.includes('bug')) {
      return 'bug'
    }
    if (typeLower === 'story' || typeLower === 'feature' || labelsLower.includes('feature')) {
      return 'feature'
    }
    if (typeLower === 'improvement' || labelsLower.includes('improvement')) {
      return 'improvement'
    }
    if (typeLower === 'epic') {
      return 'epic'
    }
    if (typeLower === 'sub-task' || typeLower === 'subtask') {
      return 'task'
    }

    return 'task'
  }

  /**
   * Map prjct type to JIRA issue type name
   */
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
      default:
        return 'Task'
    }
  }
}

// Singleton instance
export const jiraProvider = new JiraProvider()
