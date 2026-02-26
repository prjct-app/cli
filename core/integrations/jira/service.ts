/**
 * JIRA Service Layer
 * Wraps JiraProvider with caching for improved performance.
 * All operations are cached with 5-minute TTL.
 */

import { BaseIssueTrackerService } from '../issue-tracker/base-service'
import type { FetchOptions, Issue, JiraConfig } from '../issue-tracker/types'
import {
  assignedIssuesCache,
  clearJiraCache,
  getJiraCacheStats,
  issueCache,
  projectsCache,
  sprintIssuesCache,
} from './cache'
import { jiraProvider } from './client'

export class JiraService extends BaseIssueTrackerService {
  protected readonly serviceName = 'JIRA'
  protected readonly setupCommand = 'prjct jira setup'
  protected readonly provider = jiraProvider
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
    clearJiraCache()
  }

  protected getAllCacheStats() {
    return getJiraCacheStats()
  }

  /**
   * Initialize the service with config
   * Must be called before any operations
   */
  async initialize(config: JiraConfig): Promise<void> {
    return super.initialize(config)
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
    this.cacheIssues(issues)

    return issues
  }

  /**
   * Get issues assigned to current user in the active sprint (cached)
   */
  async fetchActiveSprintIssues(options?: FetchOptions): Promise<Issue[]> {
    this.ensureInitialized()

    const cacheKey = 'sprint:active'
    const cached = sprintIssuesCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const issues = await jiraProvider.fetchActiveSprintIssues(options)
    sprintIssuesCache.set(cacheKey, issues)

    this.cacheIssues(issues)

    return issues
  }

  /**
   * Get issues assigned to current user in the backlog (cached)
   */
  async fetchBacklogIssues(options?: FetchOptions): Promise<Issue[]> {
    this.ensureInitialized()

    const cacheKey = 'sprint:backlog'
    const cached = sprintIssuesCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const issues = await jiraProvider.fetchBacklogIssues(options)
    sprintIssuesCache.set(cacheKey, issues)

    this.cacheIssues(issues)

    return issues
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

    const projects = await jiraProvider.getProjects()
    projectsCache.set('projects', projects)
    return projects
  }
}

// Singleton instance
export const jiraService = new JiraService()
