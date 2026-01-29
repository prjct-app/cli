/**
 * Linear Cache Module
 * 5-minute TTL cache for Linear API responses to reduce API calls
 */

import { TTLCache } from '../../utils/cache'
import type { Issue } from '../issue-tracker/types'

// 5-minute TTL for Linear API responses
const LINEAR_CACHE_TTL = 5 * 60 * 1000 // 300000ms

/**
 * Cache for individual issues (by ID or identifier)
 * Key format: "issue:{id}" or "issue:{identifier}"
 */
export const issueCache = new TTLCache<Issue>({
  ttl: LINEAR_CACHE_TTL,
  maxSize: 100,
})

/**
 * Cache for assigned issues list
 * Key format: "assigned:{userId}" or "assigned:me"
 */
export const assignedIssuesCache = new TTLCache<Issue[]>({
  ttl: LINEAR_CACHE_TTL,
  maxSize: 10,
})

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
export const projectsCache = new TTLCache<Array<{ id: string; name: string }>>({
  ttl: LINEAR_CACHE_TTL,
  maxSize: 5,
})

/**
 * Clear all Linear caches
 */
export function clearLinearCache(): void {
  issueCache.clear()
  assignedIssuesCache.clear()
  teamsCache.clear()
  projectsCache.clear()
}

/**
 * Get cache statistics for debugging
 */
export function getLinearCacheStats() {
  return {
    issues: issueCache.stats(),
    assignedIssues: assignedIssuesCache.stats(),
    teams: teamsCache.stats(),
    projects: projectsCache.stats(),
  }
}
