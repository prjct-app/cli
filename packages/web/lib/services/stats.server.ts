/**
 * Stats Service (Server-only)
 *
 * MD-First Architecture: Reads directly from MD files.
 * No JSON fallback - MD is the source of truth.
 */

import 'server-only'
import { cache } from 'react'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getProjectStats as getMdStats, type ProjectStats, type SessionDay } from '@/lib/parse-prjct-files'
import { getProjects } from './projects.server'

// Types for MD-based stats
export interface StateJson {
  currentTask: {
    id?: string
    description: string
    startedAt?: string
    sessionId?: string
    feature?: string
    agent?: string
  } | null
  previousTask?: {
    id?: string
    description: string
    status: string
    startedAt?: string
    pausedAt?: string
  } | null
  lastUpdated?: string
}

export interface QueueTask {
  id: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  type: 'feature' | 'bug' | 'improvement' | 'chore'
  completed: boolean
  createdAt: string
  completedAt?: string
  section: 'active' | 'backlog' | 'previously_active'
  agent?: string
  originFeature?: string
}

export interface QueueJson {
  tasks: QueueTask[]
  lastUpdated: string
}

export interface MetricsJson {
  recentActivity?: Array<{ timestamp: string; type?: string; description?: string; action?: string }>
  velocity?: { tasksPerDay?: number }
  currentSprint?: { tasksCompleted?: number }
}

export interface Blocker {
  task: string
  reason: string
  since: string
  daysBlocked: number
}

export interface ProjectInsights {
  healthScore: number
  estimateAccuracy: number
  blockers: Blocker[]
  recommendations: string[]
}

export interface RoadmapFeature {
  name: string
  status?: 'pending' | 'active' | 'shipped' | 'completed'
  tasks: Array<{
    description: string
    completed: boolean
  }>
}

export interface ShippedItem {
  name: string
  date?: string
  shippedAt?: string
  duration?: string
}

export interface UnifiedJsonData {
  state: StateJson | null
  queue: QueueJson | null
  metrics: MetricsJson | null
  insights: ProjectInsights
  agents: Array<{
    name: string
    role?: string
    description?: string
    successRate?: number
    tasksCompleted?: number
    bestFor?: string[]
  }>
  ideas: { ideas: Array<{ text: string; status?: string; priority?: string }> } | null
  roadmap: { features: RoadmapFeature[] } | null
  shipped: { items: ShippedItem[] } | null
  outcomes: Array<{ type: string }>
  hasJsonData: boolean
}

// Activity type for recent activity tracking
export interface RecentActivity {
  timestamp: string
  type: string
  description?: string
  duration?: string
}

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
  queue: QueueJson | null
  metrics: MetricsJson | null
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
  blockers: [],
  recommendations: ['Run /p:sync to initialize project']
}

const EMPTY_STATS_RESULT: StatsResult = {
  state: null,
  queue: null,
  metrics: null,
  insights: DEFAULT_INSIGHTS,
  agents: [],
  ideas: null,
  roadmap: null,
  shipped: null,
  outcomes: [],
  hasData: false,
  isLegacy: false
}

/**
 * Calculate estimate accuracy from sessions
 * Returns percentage of tasks completed within ±20% of estimate
 */
function calculateEstimateAccuracy(sessions: SessionDay[]): number {
  let tasksWithEstimate = 0
  let accurateTasks = 0

  for (const session of sessions) {
    for (const event of session.events) {
      // Look for task_complete events with estimate and actual duration
      if (event.type === 'task_complete' || event.type === 'session_completed') {
        const e = event as { estimate?: string | number; duration?: string | number; actual?: number }
        if (e.estimate && (e.duration || e.actual)) {
          tasksWithEstimate++

          // Parse estimate (e.g., "2h" -> 7200 seconds, or raw number)
          const estimateSec = typeof e.estimate === 'number'
            ? e.estimate
            : parseTimeToSeconds(String(e.estimate))

          // Parse actual
          const actualSec = typeof e.actual === 'number'
            ? e.actual
            : typeof e.duration === 'number'
              ? e.duration
              : parseTimeToSeconds(String(e.duration || '0'))

          if (estimateSec > 0 && actualSec > 0) {
            const ratio = actualSec / estimateSec
            // Within ±20% is "accurate"
            if (ratio >= 0.8 && ratio <= 1.2) {
              accurateTasks++
            }
          }
        }
      }
    }
  }

  return tasksWithEstimate > 0
    ? Math.round((accurateTasks / tasksWithEstimate) * 100)
    : 0
}

/**
 * Parse time string to seconds (e.g., "2h" -> 7200, "30m" -> 1800)
 */
function parseTimeToSeconds(time: string): number {
  const hours = time.match(/(\d+(?:\.\d+)?)\s*h/i)
  const minutes = time.match(/(\d+(?:\.\d+)?)\s*m/i)
  const seconds = time.match(/(\d+(?:\.\d+)?)\s*s/i)

  let total = 0
  if (hours) total += parseFloat(hours[1]) * 3600
  if (minutes) total += parseFloat(minutes[1]) * 60
  if (seconds) total += parseFloat(seconds[1])

  // If just a number, assume seconds
  if (total === 0 && /^\d+$/.test(time.trim())) {
    total = parseInt(time.trim())
  }

  return total
}

/**
 * Extract blockers from timeline events
 */
function extractBlockers(timeline: Array<{ ts: string; type: string }>): Blocker[] {
  const blockers: Blocker[] = []
  const now = new Date()

  for (const event of timeline) {
    // Look for pause events with reason "blocked"
    if (event.type === 'pause' || event.type === 'session_paused') {
      const e = event as { reason?: string; note?: string; task?: string; ts: string }
      if (e.reason === 'blocked') {
        const pauseDate = new Date(e.ts)
        const daysBlocked = Math.floor((now.getTime() - pauseDate.getTime()) / (1000 * 60 * 60 * 24))

        blockers.push({
          task: e.task || 'Unknown task',
          reason: e.note || 'Blocked',
          since: e.ts,
          daysBlocked
        })
      }
    }
  }

  // Only return unresolved blockers (check if there's a resume after the pause)
  // For now, return all - we'll refine this when we have resume tracking
  return blockers.slice(0, 5) // Top 5 blockers
}

/**
 * Get project stats - cached per request
 *
 * MD-First Architecture: MD files are the source of truth.
 * No JSON fallback - all data comes from MD.
 */
export const getStats = cache(async (projectId: string): Promise<StatsResult> => {
  try {
    const mdStats = await getMdStats(projectId)

    // Check if we have meaningful data
    const hasData = Boolean(
      mdStats.currentTask ||
      mdStats.queue.length > 0 ||
      mdStats.shipped.length > 0 ||
      mdStats.timeline.length > 0 ||
      mdStats.summary.totalEvents > 0
    )

    if (hasData) {
      // Calculate real metrics
      const estimateAccuracy = calculateEstimateAccuracy(mdStats.sessions)
      const blockers = extractBlockers(mdStats.timeline)

      return {
        ...EMPTY_STATS_RESULT,
        insights: {
          healthScore: calculateHealthScoreV2(mdStats, estimateAccuracy, blockers),
          estimateAccuracy,
          blockers,
          recommendations: generateRecommendations(mdStats, estimateAccuracy, blockers)
        },
        hasData: true,
        isLegacy: true,
        legacyStats: mdStats
      }
    }
  } catch {
    // MD parsing failed - return empty stats
  }

  return EMPTY_STATS_RESULT
})

/**
 * Calculate health score V2 - based on real data
 *
 * Formula:
 * - estimateAccuracy (25): % of tasks within ±20% of estimate
 * - completionRate (25): tasks completed / tasks started (last 7 days)
 * - noBlockers (25): penalize if blocked tasks exist
 * - recentActivity (25): days active in last week
 */
function calculateHealthScoreV2(
  stats: ProjectStats,
  estimateAccuracy: number,
  blockers: Blocker[]
): number {
  const { timeline, sessions, currentTask } = stats

  // Estimate accuracy score (0-25)
  // If no estimates yet, give benefit of doubt (15/25)
  const accuracyScore = estimateAccuracy > 0
    ? Math.round((estimateAccuracy / 100) * 25)
    : 15

  // Completion rate (0-25)
  const recentSessions = sessions.slice(0, 7)
  let tasksStarted = 0
  let tasksCompleted = 0
  for (const session of recentSessions) {
    tasksStarted += session.tasksStarted
    tasksCompleted += session.tasksCompleted
  }
  const completionRate = tasksStarted > 0 ? tasksCompleted / tasksStarted : 0
  const completionScore = Math.round(Math.min(1, completionRate) * 25)

  // No blockers score (0-25)
  // Full points if no blockers, -5 per blocker, -10 per blocker > 3 days
  let blockerPenalty = 0
  for (const blocker of blockers) {
    blockerPenalty += blocker.daysBlocked > 3 ? 10 : 5
  }
  const blockerScore = Math.max(0, 25 - blockerPenalty)

  // Activity score (0-25)
  // Count unique active days in last 7 days
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)
  const recentDays = new Set(
    timeline
      .filter(e => new Date(e.ts) > lastWeek)
      .map(e => e.ts.split('T')[0])
  )
  // Bonus for having current task
  const activityBase = Math.min(7, recentDays.size) * 3 // up to 21
  const currentTaskBonus = currentTask ? 4 : 0
  const activityScore = Math.min(25, activityBase + currentTaskBonus)

  return Math.min(100, accuracyScore + completionScore + blockerScore + activityScore)
}

/**
 * Legacy health score calculation (kept for fallback)
 */
function calculateHealthFromMd(stats: ProjectStats): number {
  const { metrics, currentTask, queue, timeline } = stats
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

/**
 * Generate recommendations based on MD stats and insights
 */
function generateRecommendations(
  stats: ProjectStats,
  estimateAccuracy: number,
  blockers: Blocker[]
): string[] {
  const recommendations: string[] = []

  // Blocker-based recommendations (highest priority)
  if (blockers.length > 0) {
    const oldestBlocker = blockers.reduce((a, b) => a.daysBlocked > b.daysBlocked ? a : b)
    if (oldestBlocker.daysBlocked > 3) {
      recommendations.push(`Blocker "${oldestBlocker.reason}" is ${oldestBlocker.daysBlocked} days old - needs attention`)
    } else {
      recommendations.push(`${blockers.length} blocked task(s) - review blockers`)
    }
  }

  // Estimate accuracy recommendations
  if (estimateAccuracy > 0 && estimateAccuracy < 50) {
    recommendations.push('Estimates often off - consider adding 30% buffer')
  } else if (estimateAccuracy >= 80) {
    recommendations.push('Great estimation accuracy - keep it up!')
  }

  // Task state recommendations
  if (!stats.currentTask) {
    recommendations.push('Start a task with /p:now')
  }

  if (stats.queue.length === 0) {
    recommendations.push('Add tasks to queue with /p:next')
  }

  if (stats.ideas.pending.length > 10) {
    recommendations.push('Review and prioritize pending ideas')
  }

  if (stats.agents.length === 0) {
    recommendations.push('Run /p:sync to generate agents')
  }

  // Default positive message
  if (recommendations.length === 0) {
    recommendations.push('Keep shipping!')
  }

  return recommendations.slice(0, 4) // Max 4 recommendations
}

/**
 * Calculate streak from metrics (pure function, no mutation)
 */
export function calculateStreak(metrics: MetricsJson | null): number {
  if (!metrics?.recentActivity?.length) return 0

  const activityDates = new Set(
    metrics.recentActivity.map((a: { timestamp: string }) => new Date(a.timestamp).toISOString().split('T')[0])
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
 * Get insight message based on stats
 */
export function getInsightMessage(stats: StatsResult, streak: number): string {
  if (!stats.hasData) return 'Run /p:sync to get started'
  if (stats.state?.currentTask) return `Working on: ${stats.state.currentTask.description}`
  if (streak >= 7) return `${streak} day streak! You're on fire! 🔥`
  if (streak >= 3) return `${streak} day streak - keep it going!`

  const queueLength = stats.queue?.tasks?.filter(t => !t.completed).length ?? 0
  if (queueLength > 0) return `${queueLength} tasks in queue`
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
 * Get weekly velocity data from metrics (last 7 days)
 */
export function getWeeklyVelocityData(metrics: MetricsJson | null): number[] {
  if (!metrics?.recentActivity?.length) return []

  const today = new Date()

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(date.getDate() - (6 - i))
    const dateStr = date.toISOString().split('T')[0]

    return (metrics.recentActivity || []).filter((e: { timestamp: string }) =>
      e.timestamp?.startsWith(dateStr)
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
