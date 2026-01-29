/**
 * JIRA Cache Module
 * 5-minute TTL cache for JIRA API responses to reduce API calls
 */

import { TTLCache } from '../../utils/cache'
import type { Issue } from '../issue-tracker/types'

// 5-minute TTL for JIRA API responses
const JIRA_CACHE_TTL = 5 * 60 * 1000 // 300000ms

/**
 * Cache for individual issues (by key like "ENG-123" or ID)
 * Key format: "issue:{key}" or "issue:{id}"
 */
export const issueCache = new TTLCache<Issue>({
  ttl: JIRA_CACHE_TTL,
  maxSize: 100,
})

/**
 * Cache for assigned issues list
 * Key format: "assigned:{userId}" or "assigned:me"
 */
export const assignedIssuesCache = new TTLCache<Issue[]>({
  ttl: JIRA_CACHE_TTL,
  maxSize: 10,
})

/**
 * Cache for projects list
 * Key format: "projects"
 */
export const projectsCache = new TTLCache<Array<{ id: string; name: string; key?: string }>>({
  ttl: JIRA_CACHE_TTL,
  maxSize: 5,
})

/**
 * Clear all JIRA caches
 */
export function clearJiraCache(): void {
  issueCache.clear()
  assignedIssuesCache.clear()
  projectsCache.clear()
}

/**
 * Get cache statistics for debugging
 */
export function getJiraCacheStats() {
  return {
    issues: issueCache.stats(),
    assignedIssues: assignedIssuesCache.stats(),
    projects: projectsCache.stats(),
  }
}
