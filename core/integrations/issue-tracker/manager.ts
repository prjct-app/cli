/**
 * Issue Tracker Manager
 * Orchestrates multiple issue tracker providers and enrichment.
 */

import type {
  IssueTrackerProvider,
  IssueTrackerConfig,
  Issue,
  EnrichedIssue,
  SyncResult,
  FetchOptions,
  CreateIssueInput,
  IssueProvider,
} from './types'
import {
  generateEnrichmentPrompt,
  buildEnrichedIssue,
  formatEnrichmentAsMarkdown,
  generateQuickEnrichment,
  type ProjectContext,
  type EnrichmentResult,
} from './enricher'
import { linearProvider } from '../linear/client'

// =============================================================================
// Manager Class
// =============================================================================

export class IssueTrackerManager {
  private providers: Map<IssueProvider, IssueTrackerProvider> = new Map()
  private activeProvider: IssueTrackerProvider | null = null
  private config: IssueTrackerConfig | null = null

  constructor() {
    // Register available providers
    this.providers.set('linear', linearProvider)
    // Future: this.providers.set('jira', jiraProvider)
    // Future: this.providers.set('monday', mondayProvider)
  }

  /**
   * Initialize manager with config
   */
  async initialize(config: IssueTrackerConfig): Promise<void> {
    this.config = config

    if (!config.enabled) {
      console.log('[issue-tracker] Integration disabled')
      return
    }

    const provider = this.providers.get(config.provider)
    if (!provider) {
      throw new Error(`Unknown issue tracker provider: ${config.provider}`)
    }

    await provider.initialize(config)
    this.activeProvider = provider

    console.log(`[issue-tracker] Initialized ${provider.displayName}`)
  }

  /**
   * Check if manager is ready
   */
  isReady(): boolean {
    return this.activeProvider?.isConfigured() === true
  }

  /**
   * Get the active provider
   */
  getProvider(): IssueTrackerProvider | null {
    return this.activeProvider
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.activeProvider?.displayName || 'None'
  }

  // ===========================================================================
  // Issue Operations
  // ===========================================================================

  /**
   * Fetch assigned issues
   */
  async fetchAssignedIssues(options?: FetchOptions): Promise<Issue[]> {
    if (!this.activeProvider) {
      throw new Error('No issue tracker configured')
    }
    return this.activeProvider.fetchAssignedIssues(options)
  }

  /**
   * Fetch single issue
   */
  async fetchIssue(id: string): Promise<Issue | null> {
    if (!this.activeProvider) {
      throw new Error('No issue tracker configured')
    }
    return this.activeProvider.fetchIssue(id)
  }

  /**
   * Create issue
   */
  async createIssue(input: CreateIssueInput): Promise<Issue> {
    if (!this.activeProvider) {
      throw new Error('No issue tracker configured')
    }
    return this.activeProvider.createIssue(input)
  }

  /**
   * Mark issue in progress
   */
  async markInProgress(id: string): Promise<void> {
    if (!this.activeProvider) {
      throw new Error('No issue tracker configured')
    }
    return this.activeProvider.markInProgress(id)
  }

  /**
   * Mark issue done
   */
  async markDone(id: string): Promise<void> {
    if (!this.activeProvider) {
      throw new Error('No issue tracker configured')
    }
    return this.activeProvider.markDone(id)
  }

  // ===========================================================================
  // Enrichment Operations
  // ===========================================================================

  /**
   * Enrich an issue with AI-generated context
   * Returns the enrichment prompt for Claude to execute
   */
  getEnrichmentPrompt(issue: Issue, projectContext: ProjectContext): string {
    return generateEnrichmentPrompt(issue, projectContext)
  }

  /**
   * Build enriched issue from AI result
   */
  buildEnrichedIssue(issue: Issue, enrichment: EnrichmentResult): EnrichedIssue {
    return buildEnrichedIssue(issue, enrichment)
  }

  /**
   * Format enrichment as markdown for provider update
   */
  formatEnrichment(enrichment: EnrichmentResult): string {
    return formatEnrichmentAsMarkdown(enrichment)
  }

  /**
   * Quick enrichment without AI
   */
  quickEnrich(issue: Issue): EnrichedIssue {
    const enrichment = generateQuickEnrichment(issue)
    return buildEnrichedIssue(issue, enrichment)
  }

  /**
   * Update issue with enrichment in provider
   */
  async pushEnrichment(issue: Issue, enrichment: EnrichmentResult): Promise<Issue> {
    if (!this.activeProvider) {
      throw new Error('No issue tracker configured')
    }

    if (!this.config?.enrichment.updateProvider) {
      console.log('[issue-tracker] Skipping provider update (disabled)')
      return issue
    }

    const markdown = formatEnrichmentAsMarkdown(enrichment)
    return this.activeProvider.updateIssue(issue.id, {
      description: markdown,
    })
  }

  // ===========================================================================
  // Sync Operations
  // ===========================================================================

  /**
   * Sync and optionally enrich assigned issues
   */
  async syncAssignedIssues(
    projectContext: ProjectContext,
    options?: {
      enrich?: boolean
      limit?: number
    }
  ): Promise<SyncResult> {
    if (!this.activeProvider) {
      throw new Error('No issue tracker configured')
    }

    const result: SyncResult = {
      provider: this.activeProvider.name,
      fetched: 0,
      enriched: 0,
      updated: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    }

    try {
      // Fetch issues
      const issues = await this.activeProvider.fetchAssignedIssues({
        limit: options?.limit || 20,
        includeCompleted: false,
      })
      result.fetched = issues.length

      console.log(`[issue-tracker] Fetched ${issues.length} issues`)

      // Enrich if requested
      if (options?.enrich && this.config?.enrichment.enabled) {
        for (const issue of issues) {
          try {
            // Generate prompt (actual AI execution is external)
            const prompt = this.getEnrichmentPrompt(issue, projectContext)
            console.log(`[issue-tracker] Enrichment prompt ready for ${issue.externalId}`)

            // For now, use quick enrichment as placeholder
            // Real enrichment happens through Claude Code execution
            result.enriched++
          } catch (error) {
            result.errors.push({
              issueId: issue.externalId,
              error: (error as Error).message,
            })
          }
        }
      }

      return result
    } catch (error) {
      result.errors.push({
        issueId: 'sync',
        error: (error as Error).message,
      })
      return result
    }
  }

  // ===========================================================================
  // Team/Project Operations
  // ===========================================================================

  /**
   * Get available teams
   */
  async getTeams(): Promise<Array<{ id: string; name: string; key?: string }>> {
    if (!this.activeProvider) return []
    return this.activeProvider.getTeams()
  }

  /**
   * Get available projects
   */
  async getProjects(): Promise<Array<{ id: string; name: string }>> {
    if (!this.activeProvider) return []
    return this.activeProvider.getProjects()
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const issueTrackerManager = new IssueTrackerManager()
