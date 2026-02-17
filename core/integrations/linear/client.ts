/**
 * Linear Client
 * MCP-only provider implementation (no SDK/API token mode).
 */

import type {
  CreateIssueInput,
  FetchOptions,
  Issue,
  IssueTrackerProvider,
  LinearConfig,
  UpdateIssueInput,
} from '../issue-tracker/types'

export class LinearProvider implements IssueTrackerProvider {
  readonly name = 'linear' as const
  readonly displayName = 'Linear'

  private config: LinearConfig | null = null
  private initialized = false

  isConfigured(): boolean {
    return this.initialized && this.config?.enabled === true
  }

  async initialize(config: LinearConfig): Promise<void> {
    this.config = config
    this.initialized = true
    console.log('[linear] Initialized in MCP mode (direct SDK/API calls disabled)')
  }

  async fetchAssignedIssues(_options?: FetchOptions): Promise<Issue[]> {
    this.ensureConfigured()
    return this.mcpOnly('fetchAssignedIssues')
  }

  async fetchTeamIssues(_teamId: string, _options?: FetchOptions): Promise<Issue[]> {
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

  async addComment(_id: string, _body: string): Promise<void> {
    this.ensureConfigured()
    return this.mcpOnly('addComment')
  }

  async getTeams(): Promise<Array<{ id: string; name: string; key?: string }>> {
    this.ensureConfigured()
    return this.mcpOnly('getTeams')
  }

  async getProjects(): Promise<Array<{ id: string; name: string }>> {
    this.ensureConfigured()
    return this.mcpOnly('getProjects')
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('Linear not initialized. Run `prjct linear setup` to configure MCP.')
    }
  }

  private mcpOnly(operation: string): never {
    throw new Error(
      `Linear operation "${operation}" is MCP-only. Use Linear MCP tools from your AI client session.`
    )
  }
}

export const linearProvider = new LinearProvider()
