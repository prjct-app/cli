/**
 * Stats Service (Server-only)
 *
 * Direct data access for Server Components.
 * No API calls needed - reads directly from filesystem.
 */

import 'server-only'
import { cache } from 'react'
import { exec } from 'child_process'
import { promisify } from 'util'
import {
  loadUnifiedJsonData,
  hasJsonState,
  type UnifiedJsonData,
  type StateJson,
  type ProjectInsights,
  type RecentActivity
} from '@/lib/json-loader'
import { getProjectStats as getLegacyStats, type ProjectStats } from '@/lib/parse-prjct-files'
import { getProjects } from './projects.server'

export type { UnifiedJsonData, StateJson, ProjectInsights }

const execAsync = promisify(exec)

/**
 * Global stats for dashboard (userName, totalProjects)
 */
export interface GlobalStats {
  userName: string
  totalProjects: number
}

async function getGitUserName(): Promise<string> {
  try {
    const { stdout } = await execAsync('git config user.name')
    return stdout.trim() || 'Developer'
  } catch {
    return 'Developer'
  }
}

/**
 * Get global stats for dashboard - cached per request
 */
export const getGlobalStats = cache(async (): Promise<GlobalStats> => {
  const [projects, userName] = await Promise.all([
    getProjects(),
    getGitUserName()
  ])

  return {
    userName,
    totalProjects: projects.length
  }
})

/**
 * Unified stats result that works with both JSON and legacy formats
 */
export interface StatsResult {
  state: StateJson | null
  insights: ProjectInsights
  agents: UnifiedJsonData['agents']
  ideas: UnifiedJsonData['ideas']
  roadmap: UnifiedJsonData['roadmap']
  shipped: UnifiedJsonData['shipped']
  outcomes: UnifiedJsonData['outcomes']
  hasData: boolean
  isLegacy: boolean
  legacyStats?: ProjectStats
}

const DEFAULT_INSIGHTS: ProjectInsights = {
  healthScore: 0,
  estimateAccuracy: 0,
  topBlockers: [],
  patternsDetected: [],
  recommendations: ['Run /p:sync to initialize project']
}

const EMPTY_STATS_RESULT: StatsResult = {
  state: null,
  insights: DEFAULT_INSIGHTS,
  agents: [],
  ideas: [],
  roadmap: [],
  shipped: [],
  outcomes: [],
  hasData: false,
  isLegacy: false
}

/**
 * Get project stats - cached per request
 */
export const getStats = cache(async (projectId: string): Promise<StatsResult> => {
  const hasJson = await hasJsonState(projectId)

  if (hasJson) {
    const jsonData = await loadUnifiedJsonData(projectId)
    return {
      state: jsonData.state,
      insights: jsonData.insights,
      agents: jsonData.agents,
      ideas: jsonData.ideas,
      roadmap: jsonData.roadmap,
      shipped: jsonData.shipped,
      outcomes: jsonData.outcomes,
      hasData: jsonData.hasJsonData,
      isLegacy: false
    }
  }

  // Fallback to legacy markdown parsing
  try {
    const legacyStats = await getLegacyStats(projectId)
    return {
      ...EMPTY_STATS_RESULT,
      insights: {
        ...DEFAULT_INSIGHTS,
        healthScore: 50,
        recommendations: ['Run /p:sync to enable JSON format']
      },
      hasData: true,
      isLegacy: true,
      legacyStats
    }
  } catch {
    return EMPTY_STATS_RESULT
  }
})

/**
 * Calculate streak from recent activity (pure function, no mutation)
 */
export function calculateStreak(state: StateJson | null): number {
  if (!state?.recentActivity?.length) return 0

  const activityDates = new Set(
    state.recentActivity
      .filter(a => a.type === 'task_completed')
      .map(a => new Date(a.timestamp).toISOString().split('T')[0])
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Generate last 30 days as array
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    return date.toISOString().split('T')[0]
  })

  // Find first gap (day without activity)
  const firstGapIndex = days.findIndex(date => !activityDates.has(date))

  // If today has no activity, check if yesterday does
  if (firstGapIndex === 0) {
    const yesterdayHasActivity = activityDates.has(days[1])
    if (!yesterdayHasActivity) return 0
    // Start counting from yesterday
    const remainingDays = days.slice(1)
    const gapFromYesterday = remainingDays.findIndex(date => !activityDates.has(date))
    return gapFromYesterday === -1 ? remainingDays.length : gapFromYesterday
  }

  return firstGapIndex === -1 ? days.length : firstGapIndex
}

/**
 * Get health emoji based on score
 */
export function getHealthEmoji(score: number): string {
  if (score >= 80) return '🔥'
  if (score >= 60) return '💪'
  if (score >= 40) return '👍'
  if (score >= 20) return '🌱'
  return '💤'
}

/**
 * Get insight message based on stats
 */
export function getInsightMessage(stats: StatsResult, streak: number): string {
  if (!stats.hasData) return 'Run /p:sync to get started'
  if (stats.state?.currentTask) return `Working on: ${stats.state.currentTask.description}`
  if (streak >= 7) return `${streak} day streak! You're on fire! 🔥`
  if (streak >= 3) return `${streak} day streak - keep it going!`
  if (stats.state?.queue?.length) return `${stats.state.queue.length} tasks in queue`
  return 'Ready to start working'
}

/**
 * Calculate velocity change percentage
 */
export function getVelocityChange(velocity: number): number {
  if (velocity > 2) return 15
  if (velocity > 1) return 5
  if (velocity > 0) return 0
  return -10
}

/**
 * Get weekly velocity data from recent activity (last 7 days)
 */
export function getWeeklyVelocityData(recentActivity: RecentActivity[]): number[] {
  if (!recentActivity?.length) return []

  const today = new Date()

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(date.getDate() - (6 - i))
    const dateStr = date.toISOString().split('T')[0]

    return recentActivity.filter(e =>
      e.timestamp?.startsWith(dateStr) && e.type === 'task_completed'
    ).length
  })
}

/**
 * Calculate health score from stats
 */
export function calculateHealthScore(stats: StatsResult): number {
  if (!stats.hasData) return 0
  if (stats.insights.healthScore > 0) return stats.insights.healthScore

  // Fallback for legacy
  if (stats.isLegacy && stats.legacyStats) {
    const { metrics, currentTask, queue, timeline } = stats.legacyStats
    const velocity = metrics?.velocity?.tasksPerDay ?? 0
    const hasCurrentTask = Boolean(currentTask)
    const queueSize = queue?.length ?? 0
    const recentActivity = timeline?.slice(0, 7).length ?? 0

    const velocityScore = Math.min(30, velocity * 15)
    const taskScore = hasCurrentTask ? 20 : 0
    const queueScore = queueSize > 0 && queueSize < 15 ? 20 : queueSize === 0 ? 5 : 10
    const activityScore = Math.min(30, recentActivity * 5)

    return Math.min(100, Math.round(velocityScore + taskScore + queueScore + activityScore))
  }

  return 50
}
