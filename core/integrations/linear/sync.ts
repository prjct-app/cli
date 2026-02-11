/**
 * Linear Sync Layer
 *
 * Bidirectional sync between Linear and local prjct storage.
 * Uses SQLite (prjct.db) as local cache with 30-minute staleness.
 *
 * Architecture:
 *   Linear (source of truth)
 *          ↕
 *     Sync Layer (this file)
 *          ↕
 *   prjct.db kv_store('issues') ← FULL COPY of Linear issues
 *          ↕
 *   state.currentTask.linearId ← DIRECT LINK
 */

import {
  type CachedIssue,
  createEmptyIssues,
  type IssuesJson,
  type SyncResult,
} from '../../schemas/issues'
import { prjctDb } from '../../storage/database'
import { getErrorMessage } from '../../types/fs'
import type { Issue } from '../issue-tracker/types'
import { linearService } from './service'

// Default staleness threshold: 30 minutes
const DEFAULT_STALE_AFTER = 30 * 60 * 1000

export class LinearSync {
  /**
   * Pull all assigned issues from Linear and store in issues.json
   * This is the main sync operation - call on `p. sync`
   */
  async pullAll(projectId: string): Promise<SyncResult> {
    const timestamp = new Date().toISOString()
    const errors: Array<{ issueId: string; error: string }> = []

    try {
      // Fetch all assigned issues from Linear
      const issues = await linearService.fetchAssignedIssues({ limit: 100 })

      // Convert to cached format
      const issuesMap: Record<string, CachedIssue> = {}
      for (const issue of issues) {
        try {
          issuesMap[issue.externalId] = this.toCachedIssue(issue, timestamp)
        } catch (err) {
          errors.push({
            issueId: issue.externalId || issue.id,
            error: getErrorMessage(err),
          })
        }
      }

      // Write to SQLite
      const issuesJson: IssuesJson = {
        provider: 'linear',
        lastSync: timestamp,
        staleAfter: DEFAULT_STALE_AFTER,
        issues: issuesMap,
      }

      prjctDb.setDoc(projectId, 'issues', issuesJson)

      return {
        provider: 'linear',
        fetched: issues.length,
        updated: Object.keys(issuesMap).length,
        errors,
        timestamp,
      }
    } catch (err) {
      errors.push({
        issueId: 'all',
        error: getErrorMessage(err),
      })
      return {
        provider: 'linear',
        fetched: 0,
        updated: 0,
        errors,
        timestamp,
      }
    }
  }

  /**
   * Get issue from local cache, fetch from API if not found or stale
   * Local-first approach for performance
   */
  async getIssue(projectId: string, identifier: string): Promise<CachedIssue | null> {
    const issuesJson = this.loadIssues(projectId)

    // Check local cache first
    if (issuesJson?.issues[identifier]) {
      const cachedIssue = issuesJson.issues[identifier]

      // Check if cached issue is still fresh (within fetchedAt + some grace period)
      const fetchedAt = new Date(cachedIssue.fetchedAt).getTime()
      const now = Date.now()
      const issueStaleness = 10 * 60 * 1000 // 10 minutes for individual issues

      if (now - fetchedAt < issueStaleness) {
        return cachedIssue
      }
    }

    // Not in cache or stale - fetch from API and update cache
    try {
      const issue = await linearService.fetchIssue(identifier)
      if (!issue) return null

      const timestamp = new Date().toISOString()
      const cachedIssue = this.toCachedIssue(issue, timestamp)

      // Update cache with this single issue
      this.updateIssueInCache(projectId, identifier, cachedIssue)

      return cachedIssue
    } catch {
      // API failed, return cached version if available (even if stale)
      if (issuesJson?.issues[identifier]) {
        return issuesJson.issues[identifier]
      }
      return null
    }
  }

  /**
   * Get issue from local cache ONLY (no API call)
   * Use for fast lookups when you know the issue should be cached
   */
  async getIssueLocal(projectId: string, identifier: string): Promise<CachedIssue | null> {
    const issuesJson = this.loadIssues(projectId)
    return issuesJson?.issues[identifier] || null
  }

  /**
   * Push local status change to Linear
   * Called when task status changes (in_progress, done)
   */
  async pushStatus(
    projectId: string,
    identifier: string,
    status: 'in_progress' | 'done'
  ): Promise<void> {
    // Update Linear
    if (status === 'in_progress') {
      await linearService.markInProgress(identifier)
    } else if (status === 'done') {
      await linearService.markDone(identifier)
    }

    // Update local cache to reflect the change
    const issuesJson = this.loadIssues(projectId)
    if (issuesJson?.issues[identifier]) {
      const cachedStatus = status === 'done' ? 'done' : 'in_progress'
      issuesJson.issues[identifier].status = cachedStatus
      issuesJson.issues[identifier].fetchedAt = new Date().toISOString()

      this.saveIssues(projectId, issuesJson)
    }
  }

  /**
   * Check if the local issues cache is stale
   * Staleness = lastSync is older than staleAfter threshold
   */
  async isStale(projectId: string): Promise<boolean> {
    const issuesJson = this.loadIssues(projectId)

    if (!issuesJson || !issuesJson.lastSync) {
      return true // No cache = stale
    }

    const lastSyncTime = new Date(issuesJson.lastSync).getTime()
    const now = Date.now()
    const staleAfter = issuesJson.staleAfter || DEFAULT_STALE_AFTER

    return now - lastSyncTime > staleAfter
  }

  /**
   * Get sync status for display
   */
  async getSyncStatus(projectId: string): Promise<{
    hasCache: boolean
    lastSync: string | null
    issueCount: number
    isStale: boolean
  }> {
    const issuesJson = this.loadIssues(projectId)

    if (!issuesJson) {
      return {
        hasCache: false,
        lastSync: null,
        issueCount: 0,
        isStale: true,
      }
    }

    return {
      hasCache: true,
      lastSync: issuesJson.lastSync || null,
      issueCount: Object.keys(issuesJson.issues).length,
      isStale: await this.isStale(projectId),
    }
  }

  /**
   * List all cached issues
   */
  async listCachedIssues(projectId: string): Promise<CachedIssue[]> {
    const issuesJson = this.loadIssues(projectId)
    if (!issuesJson) return []

    return Object.values(issuesJson.issues)
  }

  // =============================================================================
  // Private Helpers
  // =============================================================================

  /**
   * Load issues from SQLite
   */
  private loadIssues(projectId: string): IssuesJson | null {
    try {
      return prjctDb.getDoc<IssuesJson>(projectId, 'issues')
    } catch {
      return null
    }
  }

  /**
   * Save issues to SQLite
   */
  private saveIssues(projectId: string, issuesJson: IssuesJson): void {
    prjctDb.setDoc(projectId, 'issues', issuesJson)
  }

  /**
   * Update a single issue in the cache
   */
  private updateIssueInCache(projectId: string, identifier: string, issue: CachedIssue): void {
    let issuesJson = this.loadIssues(projectId)

    if (!issuesJson) {
      issuesJson = createEmptyIssues('linear')
    }

    issuesJson.issues[identifier] = issue
    this.saveIssues(projectId, issuesJson)
  }

  /**
   * Convert API Issue to CachedIssue format
   */
  private toCachedIssue(issue: Issue, timestamp: string): CachedIssue {
    return {
      id: issue.id,
      identifier: issue.externalId,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      type: issue.type,
      assignee: issue.assignee,
      labels: issue.labels,
      team: issue.team,
      project: issue.project,
      url: issue.url,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      fetchedAt: timestamp,
    }
  }
}

// Singleton instance
export const linearSync = new LinearSync()
