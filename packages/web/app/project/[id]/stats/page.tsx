import { notFound } from 'next/navigation'
import {
  getStats,
  getInsightMessage,
  calculateStreak,
  calculateHealthScore,
  getVelocityChange,
  getWeeklyVelocityData,
  type StatsResult
} from '@/lib/services/stats.server'
import { getProject } from '@/lib/services/projects.server'
import type { TimelineEvent } from '@/lib/parse-prjct-files'

import { BentoGrid } from '@/components/BentoGrid'
import { HeroSection } from '@/components/HeroSection'
import { NowCard } from '@/components/NowCard'
import { VelocityCard } from '@/components/VelocityCard'
import { StreakCard } from '@/components/StreakCard'
import { QueueCard } from '@/components/QueueCard'
import { ShipsCard } from '@/components/ShipsCard'
import { IdeasCard } from '@/components/IdeasCard'
import { AgentsCard } from '@/components/AgentsCard'
import { RoadmapCard } from '@/components/RoadmapCard'
import { BlockersCard } from '@/components/BlockersCard'
import { ActivityTimeline } from '@/components/ActivityTimeline'

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
  const items = stats.shipped?.items ?? []
  return items.map(s => ({
    name: s.name,
    date: s.shippedAt || s.date || new Date().toISOString(),
  }))
}

function normalizeIdeas(stats: StatsResult): NormalizedIdea[] {
  const ideas = stats.ideas?.ideas ?? []
  return ideas
    .filter(i => i.status === 'pending')
    .map(i => ({
      title: i.text,
      impact: i.priority?.toUpperCase() || 'MEDIUM'
    }))
}

function normalizeAgents(stats: StatsResult): NormalizedAgent[] {
  return stats.agents.map(a => ({
    name: a.name,
    description: a.description,
    successRate: a.successRate,
    tasksCompleted: a.tasksCompleted,
    bestFor: a.bestFor,
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
  return stats.shipped?.items?.length ?? stats.legacyStats?.summary?.totalShipsEver ?? 0
}

function getTasksCompleted(stats: StatsResult): number {
  return stats.metrics?.currentSprint?.tasksCompleted ?? stats.legacyStats?.metrics?.tasksCompleted ?? 0
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
  const streak = calculateStreak(stats.metrics)
  const healthScore = calculateHealthScore(stats)
  const velocity = getVelocity(stats)
  const velocityChange = getVelocityChange(velocity)
  const insightMessage = getInsightMessage(stats, streak)
  const weeklyVelocityData = getWeeklyVelocityData(stats.metrics)

  // Normalize data for components
  const currentTask = normalizeCurrentTask(stats)
  const queue = normalizeQueue(stats)
  const roadmap = normalizeRoadmap(stats)
  const shipped = normalizeShipped(stats)
  const ideas = normalizeIdeas(stats)
  const agents = normalizeAgents(stats)
  const timeline = normalizeTimeline(stats)
  const totalShips = getTotalShips(stats)
  const tasksCompleted = getTasksCompleted(stats)

  // Extract insights
  const { estimateAccuracy, blockers } = stats.insights

  return (
    <div className="flex h-full flex-col p-4 md:p-8 overflow-auto">
      {/* Mobile: Add padding for hamburger menu */}
      <div className="pl-10 md:pl-0">
        <HeroSection
          projectId={projectId}
          projectName={project?.name ?? projectId}
          tasksCompleted={tasksCompleted}
          healthScore={healthScore}
          velocity={velocity}
          velocityChange={velocityChange}
          insightMessage={insightMessage}
          timeline={timeline}
        />
      </div>

      {/* Bento Grid - Server Components */}
      <BentoGrid className="mt-6 md:mt-8">
        <NowCard currentTask={currentTask} />
        <VelocityCard
          tasksPerDay={velocity}
          weeklyData={weeklyVelocityData}
          change={velocityChange}
          estimateAccuracy={estimateAccuracy}
        />
        <RoadmapCard roadmap={roadmap} />
        <StreakCard streak={streak} />
        <QueueCard queue={queue} />
        <ShipsCard ships={shipped} totalShips={totalShips} />
        <BlockersCard blockers={blockers} />
        <IdeasCard ideas={ideas} />
        <AgentsCard agents={agents} />
      </BentoGrid>

      {/* Activity Timeline - Client Component */}
      <div className="mt-6 md:mt-8">
        <ActivityTimeline timeline={timeline} />
      </div>

      <div className="h-6 md:h-8" />
    </div>
  )
}
