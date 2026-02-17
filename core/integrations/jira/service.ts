/**
 * JIRA Service Layer
 * Wraps JiraProvider with caching for improved performance.
 * All operations are cached with 5-minute TTL.
 */

import type {
  CreateIssueInput,
  FetchOptions,
  Issue,
  JiraConfig,
  UpdateIssueInput,
} from '../issue-tracker/types'
import {
  assignedIssuesCache,
  clearJiraCache,
  getJiraCacheStats,
  issueCache,
  projectsCache,
} from './cache'
import { jiraProvider } from './client'

export class JiraService {
  private initialized = false
  private userId: string | null = null

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized && jiraProvider.isConfigured()
  }

  /**
   * Initialize the service with config
   * Must be called before any operations
   */
  async initialize(config: JiraConfig): Promise<void> {
    if (this.initialized) return

    await jiraProvider.initialize(config)
    this.initialized = true
  }

  /**
   * Backward-compatible initializer.
   * Jira is MCP-only; email/token are ignored.
   */
  async initializeFromCredentials(
    baseUrl: string,
    _email: string,
    _apiToken: string,
    projectKey?: string
  ): Promise<void> {
    const config: JiraConfig = {
      enabled: true,
      provider: 'jira',
      baseUrl,
      projectKey,
      syncOn: { task: true, done: true, ship: true },
      enrichment: { enabled: true, updateProvider: true },
    }
    await this.initialize(config)
  }

  /**
   * Get issues assigned to current user (cached)
   */
  async fetchAssignedIssues(options?: FetchOptions): Promise<Issue[]> {
    this.ensureInitialized()

    const cacheKey = `assigned:${this.userId || 'me'}`
    const cached = assignedIssuesCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const issues = await jiraProvider.fetchAssignedIssues(options)
    assignedIssuesCache.set(cacheKey, issues)

    // Also cache individual issues
    for (const issue of issues) {
      issueCache.set(`issue:${issue.id}`, issue)
      issueCache.set(`issue:${issue.externalId}`, issue)
    }

    return issues
  }

  /**
   * Get issues from a project (cached)
   */
  async fetchProjectIssues(projectKey: string, options?: FetchOptions): Promise<Issue[]> {
    this.ensureInitialized()

    const cacheKey = `project:${projectKey}`
    const cached = assignedIssuesCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const issues = await jiraProvider.fetchTeamIssues(projectKey, options)
    assignedIssuesCache.set(cacheKey, issues)

    // Also cache individual issues
    for (const issue of issues) {
      issueCache.set(`issue:${issue.id}`, issue)
      issueCache.set(`issue:${issue.externalId}`, issue)
    }

    return issues
  }

  /**
   * Get a single issue by key (like "ENG-123") or ID (cached)
   */
  async fetchIssue(id: string): Promise<Issue | null> {
    this.ensureInitialized()

    // Check cache first
    const cacheKey = `issue:${id}`
    const cached = issueCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const issue = await jiraProvider.fetchIssue(id)
    if (issue) {
      // Cache by both ID and key
      issueCache.set(`issue:${issue.id}`, issue)
      issueCache.set(`issue:${issue.externalId}`, issue)
    }

    return issue
  }

  /**
   * Create a new issue (invalidates assigned cache)
   */
  async createIssue(input: CreateIssueInput): Promise<Issue> {
    this.ensureInitialized()

    const issue = await jiraProvider.createIssue(input)

    // Cache the new issue
    issueCache.set(`issue:${issue.id}`, issue)
    issueCache.set(`issue:${issue.externalId}`, issue)

    // Invalidate assigned issues cache (new issue may be assigned)
    assignedIssuesCache.clear()

    return issue
  }

  /**
   * Update an issue (invalidates cache for that issue)
   */
  async updateIssue(id: string, input: UpdateIssueInput): Promise<Issue> {
    this.ensureInitialized()

    const issue = await jiraProvider.updateIssue(id, input)

    // Update cache
    issueCache.set(`issue:${issue.id}`, issue)
    issueCache.set(`issue:${issue.externalId}`, issue)

    return issue
  }

  /**
   * Mark issue as in progress (invalidates cache)
   */
  async markInProgress(id: string): Promise<void> {
    this.ensureInitialized()

    await jiraProvider.markInProgress(id)

    // Invalidate caches
    issueCache.delete(`issue:${id}`)
    assignedIssuesCache.clear()
  }

  /**
   * Mark issue as done (invalidates cache)
   */
  async markDone(id: string): Promise<void> {
    this.ensureInitialized()

    await jiraProvider.markDone(id)

    // Invalidate caches
    issueCache.delete(`issue:${id}`)
    assignedIssuesCache.clear()
  }

  /**
   * Get available projects (cached)
   */
  async getProjects(): Promise<Array<{ id: string; name: string; key?: string }>> {
    this.ensureInitialized()

    const cached = projectsCache.get('projects')
    if (cached) {
      return cached
    }

    const projects = await jiraProvider.getTeams()
    projectsCache.set('projects', projects)
    return projects
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    clearJiraCache()
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return getJiraCacheStats()
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'JIRA service not initialized. Call jiraService.initialize() first or run `prjct jira setup`.'
      )
    }
  }
}

// Singleton instance
export const jiraService = new JiraService()
