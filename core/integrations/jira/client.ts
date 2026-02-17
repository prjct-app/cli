/**
 * JIRA Client
 * MCP-only provider implementation (no REST/API-token mode).
 */

import type { JiraAuthMode } from '../../types/jira'
import type {
  CreateIssueInput,
  FetchOptions,
  Issue,
  IssueTrackerProvider,
  JiraConfig,
  UpdateIssueInput,
} from '../issue-tracker/types'

export type { JiraAuthMode } from '../../types/jira'

export class JiraProvider implements IssueTrackerProvider {
  readonly name = 'jira' as const
  readonly displayName = 'JIRA'

  private config: JiraConfig | null = null
  private baseUrl = ''
  private _authMode: JiraAuthMode = 'none'

  get authMode(): JiraAuthMode {
    return this._authMode
  }

  isMCPMode(): boolean {
    return this._authMode === 'mcp'
  }

  isConfigured(): boolean {
    return this._authMode === 'mcp' && this.config?.enabled === true
  }

  async initialize(config: JiraConfig): Promise<void> {
    this.config = config
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') || ''
    this._authMode = 'mcp'

    console.log('[jira] Initialized in MCP mode (direct REST/API token calls disabled)')
  }

  getAuthInfo(): { mode: JiraAuthMode; baseUrl: string; user?: string } {
    return {
      mode: this._authMode,
      baseUrl: this.baseUrl,
    }
  }

  async fetchAssignedIssues(_options?: FetchOptions): Promise<Issue[]> {
    this.ensureConfigured()
    return this.mcpOnly('fetchAssignedIssues')
  }

  async fetchTeamIssues(_projectKey: string, _options?: FetchOptions): Promise<Issue[]> {
    this.ensureConfigured()
    return this.mcpOnly('fetchTeamIssues')
  }

  async fetchIssue(_id: string): Promise<Issue | null> {
    this.ensureConfigured()
    return this.mcpOnly('fetchIssue')
  }

  async createIssue(_input: CreateIssueInput): Promise<Issue> {
    this.ensureConfigured()
    return this.mcpOnly('createIssue')
  }

  async updateIssue(_id: string, _input: UpdateIssueInput): Promise<Issue> {
    this.ensureConfigured()
    return this.mcpOnly('updateIssue')
  }

  async markInProgress(_id: string): Promise<void> {
    this.ensureConfigured()
    return this.mcpOnly('markInProgress')
  }

  async markDone(_id: string): Promise<void> {
    this.ensureConfigured()
    return this.mcpOnly('markDone')
  }

  async getTeams(): Promise<Array<{ id: string; name: string; key?: string }>> {
    this.ensureConfigured()
    return this.mcpOnly('getTeams')
  }

  async getProjects(): Promise<Array<{ id: string; name: string }>> {
    this.ensureConfigured()
    return this.mcpOnly('getProjects')
  }

  /**
   * Fetch issues assigned to current user in the active sprint (MCP-only)
   * JQL equivalent: sprint = currentSprint() AND assignee = currentUser()
   */
  async fetchActiveSprintIssues(_options?: FetchOptions): Promise<Issue[]> {
    this.ensureConfigured()
    return this.mcpOnly('fetchActiveSprintIssues')
  }

  /**
   * Fetch issues assigned to current user in the backlog (MCP-only)
   * JQL equivalent: sprint is EMPTY AND assignee = currentUser()
   */
  async fetchBacklogIssues(_options?: FetchOptions): Promise<Issue[]> {
    this.ensureConfigured()
    return this.mcpOnly('fetchBacklogIssues')
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('JIRA not initialized. Run `prjct jira setup` to configure MCP.')
    }
  }

  private mcpOnly(operation: string): never {
    throw new Error(
      `JIRA operation "${operation}" is MCP-only. Use Jira MCP tools from your AI client session.`
    )
  }
}

export const jiraProvider = new JiraProvider()
