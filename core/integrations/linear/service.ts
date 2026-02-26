/**
 * Linear Service Layer
 * Wraps LinearProvider with caching for improved performance.
 * All operations are cached with 5-minute TTL.
 */

import { BaseIssueTrackerService } from '../issue-tracker/base-service'
import type { FetchOptions, Issue, LinearConfig } from '../issue-tracker/types'
import {
  assignedIssuesCache,
  clearLinearCache,
  getLinearCacheStats,
  issueCache,
  projectsCache,
  teamsCache,
} from './cache'
import { linearProvider } from './client'

export class LinearService extends BaseIssueTrackerService {
  protected readonly serviceName = 'Linear'
  protected readonly setupCommand = 'prjct linear setup'
  protected readonly provider = linearProvider
  protected readonly caches = {
    issues: issueCache,
    assignedIssues: assignedIssuesCache,
    clearAll: () => {
      issueCache.clear()
      assignedIssuesCache.clear()
    },
    stats: () => ({
      issues: issueCache.stats(),
      assignedIssues: assignedIssuesCache.stats(),
    }),
  }

  protected clearAllCaches(): void {
    clearLinearCache()
  }

  protected getAllCacheStats() {
    return getLinearCacheStats()
  }

  /**
   * Initialize the service with config
   * Must be called before any operations
   */
  async initialize(config: LinearConfig): Promise<void> {
    return super.initialize(config)
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
    this.cacheIssues(issues)

    return issues
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
}

// Singleton instance
export const linearService = new LinearService()
