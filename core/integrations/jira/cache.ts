/**
 * JIRA Cache Module
 * 5-minute TTL cache for JIRA API responses to reduce API calls
 */

import { TTLCache } from '../../utils/cache'
import { createTrackerCaches } from '../issue-tracker/cache-factory'
import type { Issue } from '../issue-tracker/types'

const JIRA_CACHE_TTL = 5 * 60 * 1000 // 300000ms

// Common caches shared with other trackers
const common = createTrackerCaches<{ id: string; name: string; key?: string }>()

/**
 * Cache for individual issues (by key like "ENG-123" or ID)
 * Key format: "issue:{key}" or "issue:{id}"
 */
export const issueCache = common.issues

/**
 * Cache for assigned issues list
 * Key format: "assigned:{userId}" or "assigned:me"
 */
export const assignedIssuesCache = common.assignedIssues

/**
 * Cache for projects list
 * Key format: "projects"
 */
export const projectsCache = common.projects

/**
 * Cache for sprint-scoped issue lists (active sprint or backlog)
 * Key format: "sprint:active" | "sprint:backlog"
 */
export const sprintIssuesCache = new TTLCache<Issue[]>({
  ttl: JIRA_CACHE_TTL,
  maxSize: 10,
})

/**
 * Clear all JIRA caches
 */
export function clearJiraCache(): void {
  common.clearAll()
  sprintIssuesCache.clear()
}

/**
 * Get cache statistics for debugging
 */
export function getJiraCacheStats() {
  return {
    ...common.stats(),
    sprintIssues: sprintIssuesCache.stats(),
  }
}
