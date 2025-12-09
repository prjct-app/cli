'use client'

import { use, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useProject } from '@/hooks/useProjects'
import { useProjectStats } from '@/hooks/useProjectStats'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { TimelineEvent } from '@/lib/parse-prjct-files'

import {
  BentoGrid,
  BentoCardSkeleton,
  HeroSection,
  NowCard,
  VelocityCard,
  StreakCard,
  QueueCard,
  ShipsCard,
  IdeasCard,
  AgentsCard,
  RoadmapCard,
  ActivityTimeline,
} from '@/components/stats'

// Calculate streak from timeline
function calculateStreak(timeline: TimelineEvent[]): number {
  if (!timeline.length) return 0
  const dates = new Set(timeline.map(e => e.ts?.split('T')[0]).filter(Boolean))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 30; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    if (dates.has(dateStr)) streak++
    else if (i > 0) break
  }
  return streak
}

// Health score (0-100)
function getHealthScore(stats: any): number {
  if (!stats) return 0
  const velocity = stats?.metrics?.velocity?.tasksPerDay || 0
  const hasCurrentTask = !!stats?.currentTask
  const queueSize = stats?.queue?.length || 0
  const recentActivity = stats?.timeline?.slice(0, 7).length || 0

  let score = 0
  score += Math.min(30, velocity * 15)
  score += hasCurrentTask ? 20 : 0
  score += queueSize > 0 && queueSize < 15 ? 20 : queueSize === 0 ? 5 : 10
  score += Math.min(30, recentActivity * 5)

  return Math.min(100, Math.round(score))
}

// Contextual insight message
function getInsightMessage(stats: any, streak: number): string {
  if (!stats) return ''

  const velocity = stats?.metrics?.velocity?.tasksPerDay || 0
  const hasCurrentTask = !!stats?.currentTask
  const queueSize = stats?.queue?.length || 0
  const shipsCount = stats?.summary?.totalShipsEver || 0

  if (hasCurrentTask && streak > 3) return 'Killing it. Keep the momentum.'
  if (hasCurrentTask) return 'Good focus. Ship when ready.'
  if (queueSize === 0) return 'Queue empty. Time to plan the next feature.'
  if (velocity > 2) return 'Fast pace. Watch for burnout.'
  if (shipsCount === 0) return 'No ships yet. Start small, ship fast.'
  if (streak === 0) return 'Get back in the flow. Start something.'
  return 'Steady progress. Pick the next task.'
}

// Calculate velocity change (simulated)
function getVelocityChange(velocity: number): number {
  return velocity > 2 ? 15 : velocity > 1 ? 5 : velocity > 0 ? 0 : -10
}

// Get weekly velocity data from timeline
function getWeeklyVelocityData(timeline: TimelineEvent[]): number[] {
  const today = new Date()
  const counts: number[] = []

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    const count = timeline.filter(e => {
      if (!e.ts) return false
      return e.ts.startsWith(dateStr) && e.type === 'task_complete'
    }).length

    counts.push(count)
  }

  return counts
}

function LoadingSkeleton() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start gap-6">
        <div className="h-20 w-20 rounded-full bg-muted animate-pulse" />
        <div className="space-y-3">
          <div className="h-16 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-48 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <BentoGrid>
        <BentoCardSkeleton size="2x2" />
        <BentoCardSkeleton size="1x1" />
        <BentoCardSkeleton size="2x2" />
        <BentoCardSkeleton size="1x1" />
        <BentoCardSkeleton size="1x2" />
        <BentoCardSkeleton size="1x2" />
        <BentoCardSkeleton size="1x1" />
        <BentoCardSkeleton size="1x1" />
      </BentoGrid>
    </div>
  )
}

export default function ProjectStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()

  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data, isLoading: statsLoading } = useProjectStats(projectId)
  const stats = data?.stats

  const streak = useMemo(() => calculateStreak(stats?.timeline || []), [stats?.timeline])
  const healthScore = useMemo(() => getHealthScore(stats), [stats])
  const insightMessage = useMemo(() => getInsightMessage(stats, streak), [stats, streak])
  const velocity = stats?.metrics?.velocity?.tasksPerDay || 0
  const velocityChange = useMemo(() => getVelocityChange(velocity), [velocity])
  const weeklyVelocityData = useMemo(() => getWeeklyVelocityData(stats?.timeline || []), [stats?.timeline])

  if (projectLoading || statsLoading) {
    return <LoadingSkeleton />
  }

  if (!project || !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <p className="text-4xl text-muted-foreground">404</p>
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-8 overflow-auto">
      {/* Hero Section */}
      <HeroSection
        projectId={projectId}
        projectName={project.name || projectId}
        tasksCompleted={stats.metrics.tasksCompleted}
        healthScore={healthScore}
        velocity={velocity}
        velocityChange={velocityChange}
        insightMessage={insightMessage}
        timeline={stats.timeline}
      />

      {/* Bento Grid */}
      <BentoGrid className="mt-8">
        {/* Row 1: NOW (2x2), VELOCITY (1x1), ROADMAP (2x2) */}
        <NowCard currentTask={stats.currentTask} />
        <VelocityCard
          tasksPerDay={velocity}
          weeklyData={weeklyVelocityData}
          change={velocityChange}
        />
        <RoadmapCard roadmap={stats.roadmap} />

        {/* STREAK under VELOCITY */}
        <StreakCard streak={streak} />

        {/* Row 2: QUEUE (1x2), SHIPS (1x2), IDEAS (1x1), AGENTS (1x1) */}
        <QueueCard queue={stats.queue || []} />
        <ShipsCard
          ships={stats.shipped || []}
          totalShips={stats.summary?.totalShipsEver || 0}
        />
        <IdeasCard ideas={stats.ideas?.pending || []} />
        <AgentsCard agents={stats.agents || []} />
      </BentoGrid>

      {/* Activity Timeline */}
      <div className="mt-8">
        <ActivityTimeline timeline={stats.timeline || []} />
      </div>

      <div className="h-8" />
    </div>
  )
}
