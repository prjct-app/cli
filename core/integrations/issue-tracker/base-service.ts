/**
 * Base Issue Tracker Service
 * Shared caching logic for all issue tracker services (Jira, Linear, etc.).
 * Subclasses provide the concrete provider and cache instances.
 */

import type { TTLCache } from '../../utils/cache'
import type {
  CreateIssueInput,
  FetchOptions,
  Issue,
  IssueTrackerConfig,
  IssueTrackerProvider,
  UpdateIssueInput,
} from './types'

export interface ServiceCaches {
  issues: TTLCache<Issue>
  assignedIssues: TTLCache<Issue[]>
  clearAll(): void
  stats(): Record<string, unknown>
}

export abstract class BaseIssueTrackerService {
  protected initialized = false
  protected userId: string | null = null

  /** Provider-specific display name for error messages (e.g., "JIRA", "Linear") */
  protected abstract readonly serviceName: string
  /** Setup command hint shown in initialization errors */
  protected abstract readonly setupCommand: string

  protected abstract readonly provider: IssueTrackerProvider
  protected abstract readonly caches: ServiceCaches

  /** Clear all caches, including provider-specific ones */
  protected abstract clearAllCaches(): void
  /** Return cache stats, including provider-specific ones */
  protected abstract getAllCacheStats(): Record<string, unknown>

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized && this.provider.isConfigured()
  }

  /**
   * Initialize the service with config.
   * Must be called before any operations.
   */
  async initialize(config: IssueTrackerConfig): Promise<void> {
    if (this.initialized) return

    await this.provider.initialize(config)
    this.initialized = true
  }

  /**
   * Get issues assigned to current user (cached)
   */
  async fetchAssignedIssues(options?: FetchOptions): Promise<Issue[]> {
    this.ensureInitialized()

    const cacheKey = `assigned:${this.userId || 'me'}`
    const cached = this.caches.assignedIssues.get(cacheKey)
    if (cached) {
      return cached
    }

    const issues = await this.provider.fetchAssignedIssues(options)
    this.caches.assignedIssues.set(cacheKey, issues)

    // Also cache individual issues
    this.cacheIssues(issues)

    return issues
  }

  /**
   * Get a single issue by ID or identifier (cached)
   */
  async fetchIssue(id: string): Promise<Issue | null> {
    this.ensureInitialized()

    const cacheKey = `issue:${id}`
    const cached = this.caches.issues.get(cacheKey)
    if (cached) {
      return cached
    }

    const issue = await this.provider.fetchIssue(id)
    if (issue) {
      this.cacheIssue(issue)
    }

    return issue
  }

  /**
   * Create a new issue (invalidates assigned cache)
   */
  async createIssue(input: CreateIssueInput): Promise<Issue> {
    this.ensureInitialized()

    const issue = await this.provider.createIssue(input)

    // Cache the new issue
    this.cacheIssue(issue)

    // Invalidate assigned issues cache (new issue may be assigned)
    this.caches.assignedIssues.clear()

    return issue
  }

  /**
   * Update an issue (invalidates cache for that issue)
   */
  async updateIssue(id: string, input: UpdateIssueInput): Promise<Issue> {
    this.ensureInitialized()

    const issue = await this.provider.updateIssue(id, input)

    // Update cache
    this.cacheIssue(issue)

    return issue
  }

  /**
   * Mark issue as in progress (invalidates cache)
   */
  async markInProgress(id: string): Promise<void> {
    this.ensureInitialized()

    await this.provider.markInProgress(id)

    // Invalidate caches
    this.caches.issues.delete(`issue:${id}`)
    this.caches.assignedIssues.clear()
  }

  /**
   * Mark issue as done (invalidates cache)
   */
  async markDone(id: string): Promise<void> {
    this.ensureInitialized()

    await this.provider.markDone(id)

    // Invalidate caches
    this.caches.issues.delete(`issue:${id}`)
    this.caches.assignedIssues.clear()
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.clearAllCaches()
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return this.getAllCacheStats()
  }

  /**
   * Ensure service is initialized
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        `${this.serviceName} service not initialized. Call initialize() first or run \`${this.setupCommand}\`.`
      )
    }
  }

  /** Cache a single issue by both id and externalId */
  protected cacheIssue(issue: Issue): void {
    this.caches.issues.set(`issue:${issue.id}`, issue)
    this.caches.issues.set(`issue:${issue.externalId}`, issue)
  }

  /** Cache a list of issues individually */
  protected cacheIssues(issues: Issue[]): void {
    for (const issue of issues) {
      this.cacheIssue(issue)
    }
  }
}
