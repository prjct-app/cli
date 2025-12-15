import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getStats,
  getInsightMessage,
  calculateStreak,
  getVelocityChange,
  getWeeklyVelocityData,
  type StatsResult
} from '@/lib/services/stats.server'
import { getProject } from '@/lib/services/projects.server'
import { getProjectEmoji } from '@/lib/project-colors'
import type { TimelineEvent } from '@/lib/parse-prjct-files'

import { HeroSection } from '@/components/HeroSection'
import { StatsMasonry } from '@/components/StatsMasonry'

// Dynamic metadata for browser tab title
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: projectId } = await params
  const project = await getProject(projectId)
  const projectName = project?.name ?? projectId
  const emoji = getProjectEmoji(projectId)

  return {
    title: `${emoji} ${projectName} / p.`,
  }
}

// Types for normalized component data
interface NormalizedCurrentTask {
  task: string
  startedAt?: string
  agent?: string
  estimatedDuration?: string
  pausedAt?: string
  pauseReason?: string
}

interface NormalizedQueueItem {
  task: string
  priority?: 'low' | 'medium' | 'high' | 'critical' | number
  estimatedDuration?: string
}

interface NormalizedShip {
  name: string
  date: string
  duration?: string
}

interface NormalizedIdea {
  title: string
  impact?: string
}

interface NormalizedAgent {
  name: string
  description?: string
  successRate?: number
  tasksCompleted?: number
  bestFor?: string[]
}

interface NormalizedRoadmap {
  phases: Array<{
    name: string
    progress: number
    features?: Array<{ name: string; status: string }>
  }>
  progress: number
}

// Data normalization functions
function normalizeCurrentTask(stats: StatsResult): NormalizedCurrentTask | null {
  if (stats.state?.currentTask) {
    return {
      task: stats.state.currentTask.description,
      startedAt: stats.state.currentTask.startedAt,
      // Simplified - removed legacy fields not in new schema
    }
  }
  return stats.legacyStats?.currentTask ?? null
}

function normalizeQueue(stats: StatsResult): NormalizedQueueItem[] {
  if (stats.queue?.tasks) {
    return stats.queue.tasks
      .filter(t => !t.completed)
      .map(q => ({
        task: q.description,
        priority: q.priority,
      }))
  }
  return stats.legacyStats?.queue ?? []
}

function normalizeRoadmap(stats: StatsResult): NormalizedRoadmap | null {
  const features = stats.roadmap?.features ?? []
  if (features.length > 0) {
    const completed = features.filter(f =>
      f.status === 'shipped' || f.status === 'completed'
    ).length

    return {
      phases: features.map(f => ({
        name: f.name,
        progress: f.status === 'shipped' || f.status === 'completed' ? 100 :
                  f.status === 'active' ? 50 : 0,
        features: f.tasks.map(t => ({
          name: t.description,
          status: t.completed ? 'completed' : 'pending'
        }))
      })),
      progress: Math.round((completed / features.length) * 100)
    }
  }
  return stats.legacyStats?.roadmap ?? null
}

function normalizeShipped(stats: StatsResult): NormalizedShip[] {
  // Try new format first
  const items = stats.shipped?.items ?? []
  if (items.length > 0) {
    return items.map(s => ({
      name: s.name,
      date: s.shippedAt || s.date || new Date().toISOString(),
    }))
  }
  // Fallback to legacy
  return (stats.legacyStats?.shipped ?? []).map(s => ({
    name: s.name,
    date: s.date,
    duration: s.time,
  }))
}

function normalizeIdeas(stats: StatsResult): NormalizedIdea[] {
  // Try new format first
  const ideas = stats.ideas?.ideas ?? []
  if (ideas.length > 0) {
    return ideas
      .filter(i => i.status === 'pending')
      .map(i => ({
        title: i.text,
        impact: i.priority?.toUpperCase() || 'MEDIUM'
      }))
  }
  // Fallback to legacy
  return (stats.legacyStats?.ideas?.pending ?? []).map(i => ({
    title: i.title,
    impact: i.impact?.toUpperCase() || 'MEDIUM'
  }))
}

function normalizeAgents(stats: StatsResult): NormalizedAgent[] {
  // Try new format first
  if (stats.agents.length > 0) {
    return stats.agents.map(a => ({
      name: a.name,
      description: a.description,
      successRate: a.successRate,
      tasksCompleted: a.tasksCompleted,
      bestFor: a.bestFor,
    }))
  }
  // Fallback to legacy
  return (stats.legacyStats?.agents ?? []).map(a => ({
    name: a.name,
    description: a.role,
    bestFor: a.whenToUse,
  }))
}

function normalizeTimeline(stats: StatsResult): TimelineEvent[] {
  if (stats.metrics?.recentActivity?.length) {
    return stats.metrics.recentActivity.map(a => ({
      ts: a.timestamp,
      type: a.action || a.type || 'task_completed',
      task: a.description || '',
    }))
  }
  return stats.legacyStats?.timeline ?? []
}

function getVelocity(stats: StatsResult): number {
  if (stats.metrics?.velocity?.tasksPerDay) {
    return stats.metrics.velocity.tasksPerDay
  }
  return stats.legacyStats?.metrics?.velocity?.tasksPerDay ?? 0
}

function getTotalShips(stats: StatsResult): number {
  // Use shipped.md items count (legacyStats.shipped) as source of truth
  return stats.shipped?.items?.length ?? stats.legacyStats?.shipped?.length ?? 0
}

function getCompletionRate(stats: StatsResult): number {
  const completed = stats.legacyStats?.shipped?.length ?? 0
  const pending = stats.legacyStats?.queue?.length ?? 0
  const total = completed + pending
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
}

// Calculate streak from legacy timeline
function calculateStreakFromTimeline(stats: StatsResult): number {
  const timeline = stats.legacyStats?.timeline ?? []
  if (timeline.length === 0) return 0

  const activityDates = new Set(
    timeline.map(e => e.ts?.split('T')[0]).filter(Boolean)
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    return date.toISOString().split('T')[0]
  })

  const firstGapIndex = days.findIndex(date => !activityDates.has(date))

  if (firstGapIndex === 0) {
    const yesterdayHasActivity = activityDates.has(days[1])
    if (!yesterdayHasActivity) return 0
    const remainingDays = days.slice(1)
    const gapFromYesterday = remainingDays.findIndex(date => !activityDates.has(date))
    return gapFromYesterday === -1 ? remainingDays.length : gapFromYesterday
  }

  return firstGapIndex === -1 ? days.length : firstGapIndex
}

// Get weekly velocity data from legacy timeline
function getWeeklyDataFromTimeline(stats: StatsResult): number[] {
  const timeline = stats.legacyStats?.timeline ?? []
  if (timeline.length === 0) return []

  const today = new Date()

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(date.getDate() - (6 - i))
    const dateStr = date.toISOString().split('T')[0]

    return timeline.filter(e => e.ts?.startsWith(dateStr)).length
  })
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectStatsPage({ params }: PageProps) {
  const { id: projectId } = await params

  // Fetch data directly on server - no API calls
  const [project, stats] = await Promise.all([
    getProject(projectId),
    getStats(projectId)
  ])

  if (!stats.hasData) {
    notFound()
  }

  // Compute derived values using service functions
  // Use legacy timeline for streak/weekly if metrics is empty
  const streak = stats.metrics?.recentActivity?.length
    ? calculateStreak(stats.metrics)
    : calculateStreakFromTimeline(stats)
  const velocity = getVelocity(stats)
  const velocityChange = getVelocityChange(velocity)
  const insightMessage = getInsightMessage(stats, streak)
  const weeklyVelocityData = stats.metrics?.recentActivity?.length
    ? getWeeklyVelocityData(stats.metrics)
    : getWeeklyDataFromTimeline(stats)

  // Normalize data for components
  const currentTask = normalizeCurrentTask(stats)
  const queue = normalizeQueue(stats)
  const roadmap = normalizeRoadmap(stats)
  const shipped = normalizeShipped(stats)
  const ideas = normalizeIdeas(stats)
  const agents = normalizeAgents(stats)
  const timeline = normalizeTimeline(stats)

  // DRY: Use counts from getProject() - same source as dashboard
  const totalShips = project?.shippedCount ?? 0
  const completionRate = project?.completionRate ?? 0

  // Extract insights
  const { estimateAccuracy, blockers } = stats.insights

  return (
    <div className="flex h-full flex-col p-4 md:p-6 overflow-auto overflow-x-hidden">
      {/* Mobile: Add padding for hamburger menu */}
      <div className="pl-10 md:pl-0">
        <HeroSection
          projectId={projectId}
          projectName={project?.name ?? projectId}
          projectVersion={project?.version}
          totalShips={totalShips}
          completionRate={completionRate}
          streak={streak}
          insightMessage={insightMessage}
          timeline={timeline}
        />
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4 mb-6">
        <div className="bg-card border rounded-lg p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-bold tabular-nums">{totalShips}</div>
            <div className="text-xs text-muted-foreground truncate">Shipped</div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-bold tabular-nums">{queue.length}</div>
            <div className="text-xs text-muted-foreground truncate">Queue</div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-bold tabular-nums">{streak}</div>
            <div className="text-xs text-muted-foreground truncate">Streak</div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-bold tabular-nums">{ideas.length}</div>
            <div className="text-xs text-muted-foreground truncate">Ideas</div>
          </div>
        </div>
      </div>

      {/* Main Content - Masonry Layout */}
      <StatsMasonry
        projectId={projectId}
        currentTask={currentTask}
        velocity={velocity}
        weeklyVelocityData={weeklyVelocityData}
        velocityChange={velocityChange}
        estimateAccuracy={estimateAccuracy}
        roadmap={roadmap}
        queue={queue}
        shipped={shipped}
        totalShips={totalShips}
        streak={streak}
        blockers={blockers}
        ideas={ideas}
        agents={agents}
        timeline={timeline}
      />

      <div className="h-4" />
    </div>
  )
}
