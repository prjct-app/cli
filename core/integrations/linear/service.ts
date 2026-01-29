/**
 * Linear Service Layer
 * Wraps LinearProvider with caching for improved performance.
 * All operations are cached with 5-minute TTL.
 */

import { linearProvider } from './client'
import {
  issueCache,
  assignedIssuesCache,
  teamsCache,
  projectsCache,
  clearLinearCache,
  getLinearCacheStats,
} from './cache'
import type {
  Issue,
  CreateIssueInput,
  UpdateIssueInput,
  FetchOptions,
  LinearConfig,
} from '../issue-tracker/types'

export class LinearService {
  private initialized = false
  private userId: string | null = null

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized && linearProvider.isConfigured()
  }

  /**
   * Initialize the service with config
   * Must be called before any operations
   */
  async initialize(config: LinearConfig): Promise<void> {
    if (this.initialized) return

    await linearProvider.initialize(config)
    this.initialized = true
  }

  /**
   * Initialize from API key directly
   * Convenience method for simple setup
   */
  async initializeFromApiKey(apiKey: string, teamId?: string): Promise<void> {
    const config: LinearConfig = {
      enabled: true,
      provider: 'linear',
      apiKey,
      defaultTeamId: teamId,
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

    const issues = await linearProvider.fetchAssignedIssues(options)
    assignedIssuesCache.set(cacheKey, issues)

    // Also cache individual issues
    for (const issue of issues) {
      issueCache.set(`issue:${issue.id}`, issue)
      issueCache.set(`issue:${issue.externalId}`, issue)
    }

    return issues
  }

  /**
   * Get issues from a team (cached)
   */
  async fetchTeamIssues(teamId: string, options?: FetchOptions): Promise<Issue[]> {
    this.ensureInitialized()

    const cacheKey = `team:${teamId}`
    const cached = assignedIssuesCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const issues = await linearProvider.fetchTeamIssues(teamId, options)
    assignedIssuesCache.set(cacheKey, issues)

    // Also cache individual issues
    for (const issue of issues) {
      issueCache.set(`issue:${issue.id}`, issue)
      issueCache.set(`issue:${issue.externalId}`, issue)
    }

    return issues
  }

  /**
   * Get a single issue by ID or identifier (cached)
   * Accepts UUID or identifier like "PRJ-123"
   */
  async fetchIssue(id: string): Promise<Issue | null> {
    this.ensureInitialized()

    // Check cache first
    const cacheKey = `issue:${id}`
    const cached = issueCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const issue = await linearProvider.fetchIssue(id)
    if (issue) {
      // Cache by both ID and externalId
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

    const issue = await linearProvider.createIssue(input)

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

    const issue = await linearProvider.updateIssue(id, input)

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

    await linearProvider.markInProgress(id)

    // Invalidate caches
    issueCache.delete(`issue:${id}`)
    assignedIssuesCache.clear()
  }

  /**
   * Mark issue as done (invalidates cache)
   */
  async markDone(id: string): Promise<void> {
    this.ensureInitialized()

    await linearProvider.markDone(id)

    // Invalidate caches
    issueCache.delete(`issue:${id}`)
    assignedIssuesCache.clear()
  }

  /**
   * Add a comment to an issue
   */
  async addComment(id: string, body: string): Promise<void> {
    this.ensureInitialized()
    await linearProvider.addComment(id, body)
  }

  /**
   * Get available teams (cached)
   */
  async getTeams(): Promise<Array<{ id: string; name: string; key?: string }>> {
    this.ensureInitialized()

    const cached = teamsCache.get('teams')
    if (cached) {
      return cached
    }

    const teams = await linearProvider.getTeams()
    teamsCache.set('teams', teams)
    return teams
  }

  /**
   * Get available projects (cached)
   */
  async getProjects(): Promise<Array<{ id: string; name: string }>> {
    this.ensureInitialized()

    const cached = projectsCache.get('projects')
    if (cached) {
      return cached
    }

    const projects = await linearProvider.getProjects()
    projectsCache.set('projects', projects)
    return projects
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    clearLinearCache()
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return getLinearCacheStats()
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'Linear service not initialized. Call linearService.initialize() first or run `p. linear setup`.'
      )
    }
  }
}

// Singleton instance
export const linearService = new LinearService()
