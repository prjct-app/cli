/**
 * Linear Cache Module
 * 5-minute TTL cache for Linear API responses to reduce API calls
 */

import { TTLCache } from '../../utils/cache'
import { createTrackerCaches } from '../issue-tracker/cache-factory'

const LINEAR_CACHE_TTL = 5 * 60 * 1000 // 300000ms

// Common caches shared with other trackers
const common = createTrackerCaches<{ id: string; name: string }>()

/**
 * Cache for individual issues (by ID or identifier)
 * Key format: "issue:{id}" or "issue:{identifier}"
 */
export const issueCache = common.issues

/**
 * Cache for assigned issues list
 * Key format: "assigned:{userId}" or "assigned:me"
 */
export const assignedIssuesCache = common.assignedIssues

/**
 * Cache for teams list
 * Key format: "teams"
 */
export const teamsCache = new TTLCache<Array<{ id: string; name: string; key?: string }>>({
  ttl: LINEAR_CACHE_TTL,
  maxSize: 5,
})

/**
 * Cache for projects list
 * Key format: "projects"
 */
export const projectsCache = common.projects

/**
 * Clear all Linear caches
 */
export function clearLinearCache(): void {
  common.clearAll()
  teamsCache.clear()
}

/**
 * Get cache statistics for debugging
 */
export function getLinearCacheStats() {
  return {
    ...common.stats(),
    teams: teamsCache.stats(),
  }
}
