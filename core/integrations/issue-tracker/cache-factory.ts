/**
 * Issue Tracker Cache Factory
 * Creates common TTL caches shared by all issue tracker integrations (Jira, Linear, etc.)
 * Provider-specific caches (sprintIssuesCache, teamsCache) are added separately.
 */

import { TTLCache } from '../../utils/cache'
import type { Issue } from './types'

const TRACKER_CACHE_TTL = 5 * 60 * 1000 // 300000ms

/**
 * Create the common set of caches used by every issue tracker provider.
 *
 * @typeParam TProject - Shape of project objects (varies slightly between providers)
 */
export function createTrackerCaches<TProject = { id: string; name: string; key?: string }>() {
  const issues = new TTLCache<Issue>({
    ttl: TRACKER_CACHE_TTL,
    maxSize: 100,
  })

  const assignedIssues = new TTLCache<Issue[]>({
    ttl: TRACKER_CACHE_TTL,
    maxSize: 10,
  })

  const projects = new TTLCache<TProject[]>({
    ttl: TRACKER_CACHE_TTL,
    maxSize: 5,
  })

  return {
    issues,
    assignedIssues,
    projects,

    clearAll() {
      issues.clear()
      assignedIssues.clear()
      projects.clear()
    },

    stats() {
      return {
        issues: issues.stats(),
        assignedIssues: assignedIssues.stats(),
        projects: projects.stats(),
      }
    },
  }
}
