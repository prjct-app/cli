/**
 * Linear Client
 * Implements IssueTrackerProvider for Linear using @linear/sdk
 */

import { LinearClient as LinearSDK } from '@linear/sdk'
import { getCredential } from '../../utils/keychain'
import type {
  CreateIssueInput,
  FetchOptions,
  Issue,
  IssuePriority,
  IssueStatus,
  IssueTrackerProvider,
  IssueType,
  LinearConfig,
  UpdateIssueInput,
} from '../issue-tracker/types'

// =============================================================================
// Status/Priority Mapping
// =============================================================================

const LINEAR_STATUS_MAP: Record<string, IssueStatus> = {
  backlog: 'backlog',
  unstarted: 'todo',
  started: 'in_progress',
  completed: 'done',
  canceled: 'cancelled',
  cancelled: 'cancelled',
}

const LINEAR_PRIORITY_MAP: Record<number, IssuePriority> = {
  0: 'none',
  1: 'urgent',
  2: 'high',
  3: 'medium',
  4: 'low',
}

const PRIORITY_TO_LINEAR: Record<IssuePriority, number> = {
  none: 0,
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
}

// =============================================================================
// Linear Provider Implementation
// =============================================================================

export class LinearProvider implements IssueTrackerProvider {
  readonly name = 'linear' as const
  readonly displayName = 'Linear'

  private sdk: LinearSDK | null = null
  private config: LinearConfig | null = null

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return this.sdk !== null && this.config?.enabled === true
  }

  /**
   * Initialize with config
   * Looks for API key in: 1) config.apiKey, 2) macOS Keychain, 3) LINEAR_API_KEY env var
   */
  async initialize(config: LinearConfig): Promise<void> {
    this.config = config

    // Try config first, then keychain (which falls back to env var)
    const apiKey = config.apiKey || (await getCredential('linear-api-key'))
    if (!apiKey) {
      throw new Error('LINEAR_API_KEY not configured. Run `p. linear setup` to configure.')
    }

    this.sdk = new LinearSDK({ apiKey })

    // Verify connection
    try {
      const viewer = await this.sdk.viewer
      // Use stderr for logs to not break JSON output
      console.error(`[linear] Connected as ${viewer.name} (${viewer.email})`)
    } catch (error) {
      this.sdk = null
      throw new Error(`Linear connection failed: ${(error as Error).message}`)
    }
  }

  /**
   * Get issues assigned to current user
   * Filters by configured team if defaultTeamId is set
   */
  async fetchAssignedIssues(options?: FetchOptions): Promise<Issue[]> {
    if (!this.sdk) throw new Error('Linear not initialized')

    const viewer = await this.sdk.viewer

    // Build filter - always filter by team if configured
    const filter: Record<string, unknown> = {}

    if (!options?.includeCompleted) {
      filter.state = { type: { nin: ['completed', 'canceled'] } }
    }

    // Filter by configured team to only show relevant issues
    if (this.config?.defaultTeamId) {
      filter.team = { id: { eq: this.config.defaultTeamId } }
    }

    const assignedIssues = await viewer.assignedIssues({
      first: options?.limit || 50,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    })

    return Promise.all(assignedIssues.nodes.map((issue) => this.mapIssue(issue)))
  }

  /**
   * Get issues from a team
   */
  async fetchTeamIssues(teamId: string, options?: FetchOptions): Promise<Issue[]> {
    if (!this.sdk) throw new Error('Linear not initialized')

    const team = await this.sdk.team(teamId)
    const issues = await team.issues({
      first: options?.limit || 50,
      filter: options?.includeCompleted
        ? undefined
        : { state: { type: { nin: ['completed', 'canceled'] } } },
    })

    return Promise.all(issues.nodes.map((issue) => this.mapIssue(issue)))
  }

  /**
   * Get a single issue by ID or identifier (e.g., "PRJ-123")
   */
  async fetchIssue(id: string): Promise<Issue | null> {
    if (!this.sdk) throw new Error('Linear not initialized')

    try {
      // Check if it looks like an identifier (e.g., "PRJ-123")
      if (id.includes('-') && /^[A-Z]+-\d+$/.test(id)) {
        // Parse identifier into team key and issue number
        const match = id.match(/^([A-Z]+)-(\d+)$/)
        if (!match) return null

        const [, teamKey, numberStr] = match
        const issueNumber = parseInt(numberStr, 10)

        // Find team by key
        const teams = await this.sdk.teams({ first: 50 })
        const team = teams.nodes.find((t) => t.key === teamKey)
        if (!team) return null

        // Query issue by team and number
        const issues = await team.issues({
          first: 1,
          filter: { number: { eq: issueNumber } },
        })

        if (issues.nodes.length > 0) {
          return this.mapIssue(issues.nodes[0])
        }
        return null
      }

      // Try by UUID directly
      const issue = await this.sdk.issue(id)
      return this.mapIssue(issue)
    } catch (_error) {
      return null
    }
  }

  /**
   * Create a new issue
   */
  async createIssue(input: CreateIssueInput): Promise<Issue> {
    if (!this.sdk) throw new Error('Linear not initialized')

    const teamId = input.teamId || this.config?.defaultTeamId
    if (!teamId) {
      throw new Error('Team ID required for creating issues')
    }

    const payload = await this.sdk.createIssue({
      teamId,
      title: input.title,
      description: input.description,
      priority: input.priority ? PRIORITY_TO_LINEAR[input.priority] : undefined,
      projectId: input.projectId || this.config?.defaultProjectId,
      assigneeId: input.assigneeId,
      labelIds: input.labels ? await this.resolveLabelIds(teamId, input.labels) : undefined,
    })

    const createdIssue = await payload.issue
    if (!createdIssue) {
      throw new Error('Failed to create issue')
    }

    return this.mapIssue(createdIssue)
  }

  /**
   * Update an issue
   */
  async updateIssue(id: string, input: UpdateIssueInput): Promise<Issue> {
    if (!this.sdk) throw new Error('Linear not initialized')

    // Get the issue first to get UUID (if identifier like PRJ-123 was passed)
    const issue = await this.fetchIssue(id)
    if (!issue) {
      throw new Error(`Issue ${id} not found`)
    }

    // Build update payload with all supported fields
    const updatePayload: Record<string, unknown> = {}

    if (input.title !== undefined) updatePayload.title = input.title
    if (input.description !== undefined) updatePayload.description = input.description
    if (input.priority !== undefined) updatePayload.priority = PRIORITY_TO_LINEAR[input.priority]
    if (input.assigneeId !== undefined) updatePayload.assigneeId = input.assigneeId
    if (input.stateId !== undefined) updatePayload.stateId = input.stateId
    if (input.projectId !== undefined) updatePayload.projectId = input.projectId

    // Handle labels - need to resolve names to IDs
    if (input.labels !== undefined && issue.team) {
      updatePayload.labelIds = await this.resolveLabelIds(issue.team.id, input.labels)
    }

    await this.sdk.updateIssue(issue.id, updatePayload)

    // Fetch updated issue
    const updated = await this.fetchIssue(issue.id)
    if (!updated) {
      throw new Error('Failed to fetch updated issue')
    }

    return updated
  }

  /**
   * Mark issue as in progress
   */
  async markInProgress(id: string): Promise<void> {
    if (!this.sdk) throw new Error('Linear not initialized')

    const issue = await this.fetchIssue(id)
    if (!issue) throw new Error(`Issue ${id} not found`)

    // Find "started" state for the team
    const linearIssue = await this.sdk.issue(issue.id)
    const team = await linearIssue.team
    if (!team) throw new Error('Issue has no team')

    const states = await team.states()
    const startedState = states.nodes.find((s) => s.type === 'started')

    if (startedState) {
      await this.sdk.updateIssue(issue.id, { stateId: startedState.id })
    }
  }

  /**
   * Mark issue as done
   */
  async markDone(id: string): Promise<void> {
    if (!this.sdk) throw new Error('Linear not initialized')

    const issue = await this.fetchIssue(id)
    if (!issue) throw new Error(`Issue ${id} not found`)

    // Find "completed" state for the team
    const linearIssue = await this.sdk.issue(issue.id)
    const team = await linearIssue.team
    if (!team) throw new Error('Issue has no team')

    const states = await team.states()
    const doneState = states.nodes.find((s) => s.type === 'completed')

    if (doneState) {
      await this.sdk.updateIssue(issue.id, { stateId: doneState.id })
    }
  }

  /**
   * Add a comment to an issue
   */
  async addComment(id: string, body: string): Promise<void> {
    if (!this.sdk) throw new Error('Linear not initialized')

    const issue = await this.fetchIssue(id)
    if (!issue) throw new Error(`Issue ${id} not found`)

    await this.sdk.createComment({
      issueId: issue.id,
      body,
    })
  }

  /**
   * Get available teams
   */
  async getTeams(): Promise<Array<{ id: string; name: string; key?: string }>> {
    if (!this.sdk) throw new Error('Linear not initialized')

    const teams = await this.sdk.teams({ first: 50 })
    return teams.nodes.map((team) => ({
      id: team.id,
      name: team.name,
      key: team.key,
    }))
  }

  /**
   * Get available projects
   */
  async getProjects(): Promise<Array<{ id: string; name: string }>> {
    if (!this.sdk) throw new Error('Linear not initialized')

    const projects = await this.sdk.projects({ first: 50 })
    return projects.nodes.map((project) => ({
      id: project.id,
      name: project.name,
    }))
  }

  // =============================================================================
  // Private Helpers
  // =============================================================================

  /**
   * Map Linear issue to normalized Issue
   */
  private async mapIssue(linearIssue: Awaited<ReturnType<LinearSDK['issue']>>): Promise<Issue> {
    const state = await linearIssue.state
    const assignee = await linearIssue.assignee
    const team = await linearIssue.team
    const project = await linearIssue.project
    const labels = await linearIssue.labels()

    return {
      id: linearIssue.id,
      externalId: linearIssue.identifier,
      provider: 'linear',
      title: linearIssue.title,
      description: linearIssue.description || undefined,
      status: LINEAR_STATUS_MAP[state?.type || 'backlog'] || 'backlog',
      priority: LINEAR_PRIORITY_MAP[linearIssue.priority] || 'none',
      type: this.inferType(
        linearIssue.title,
        labels.nodes.map((l) => l.name)
      ),
      assignee: assignee
        ? {
            id: assignee.id,
            name: assignee.name,
            email: assignee.email,
          }
        : undefined,
      labels: labels.nodes.map((l) => l.name),
      team: team
        ? {
            id: team.id,
            name: team.name,
            key: team.key,
          }
        : undefined,
      project: project
        ? {
            id: project.id,
            name: project.name,
          }
        : undefined,
      url: linearIssue.url,
      createdAt: linearIssue.createdAt.toISOString(),
      updatedAt: linearIssue.updatedAt.toISOString(),
      raw: linearIssue,
    }
  }

  /**
   * Infer issue type from title and labels
   */
  private inferType(title: string, labels: string[]): IssueType {
    const titleLower = title.toLowerCase()
    const labelsLower = labels.map((l) => l.toLowerCase())

    if (labelsLower.includes('bug') || titleLower.includes('fix') || titleLower.includes('bug')) {
      return 'bug'
    }
    if (
      labelsLower.includes('feature') ||
      titleLower.includes('add') ||
      titleLower.includes('implement')
    ) {
      return 'feature'
    }
    if (
      labelsLower.includes('improvement') ||
      titleLower.includes('improve') ||
      titleLower.includes('enhance')
    ) {
      return 'improvement'
    }
    if (
      labelsLower.includes('chore') ||
      titleLower.includes('chore') ||
      titleLower.includes('deps')
    ) {
      return 'chore'
    }

    return 'task'
  }

  /**
   * Resolve label names to IDs
   */
  private async resolveLabelIds(teamId: string, labelNames: string[]): Promise<string[]> {
    if (!this.sdk) return []

    const team = await this.sdk.team(teamId)
    const labels = await team.labels()

    return labels.nodes.filter((label) => labelNames.includes(label.name)).map((label) => label.id)
  }
}

// Singleton instance
export const linearProvider = new LinearProvider()
