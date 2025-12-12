'use client'

import { useEffect, useState } from 'react'
import { MasonryGrid } from '@/components/MasonryGrid'
import { NowCard } from '@/components/NowCard'
import { VelocityCard } from '@/components/VelocityCard'
import { StreakCard } from '@/components/StreakCard'
import { QueueCard } from '@/components/QueueCard'
import { ShipsCard } from '@/components/ShipsCard'
import { IdeasCard } from '@/components/IdeasCard'
import { AgentsCard } from '@/components/AgentsCard'
import { RoadmapCard } from '@/components/RoadmapCard'
import { BlockersCard } from '@/components/BlockersCard'
import { RecoverCard, type AbandonedSession } from '@/components/RecoverCard'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import type { TimelineEvent } from '@/lib/parse-prjct-files'

interface StatsMasonryProps {
  projectId: string
  currentTask: any
  velocity: number
  weeklyVelocityData: number[]
  velocityChange: number
  estimateAccuracy?: number
  roadmap: any
  queue: any[]
  shipped: any[]
  totalShips: number
  streak: number
  blockers: any[]
  ideas: any[]
  agents: any[]
  timeline: TimelineEvent[]
}

export function StatsMasonry({
  projectId,
  currentTask,
  velocity,
  weeklyVelocityData,
  velocityChange,
  estimateAccuracy,
  roadmap,
  queue,
  shipped,
  totalShips,
  streak,
  blockers,
  ideas,
  agents,
  timeline,
}: StatsMasonryProps) {
  const codeHref = `/project/${projectId}/code`
  const [abandonedSessions, setAbandonedSessions] = useState<AbandonedSession[]>([])

  // Fetch abandoned sessions from API
  useEffect(() => {
    async function fetchAbandonedSessions() {
      try {
        const res = await fetch(`/api/sessions/current?projectId=${projectId}`)
        const data = await res.json()
        if (data.success && data.data.abandonedSessions) {
          setAbandonedSessions(data.data.abandonedSessions)
        }
      } catch {
        // Silently fail - abandoned sessions are not critical
      }
    }
    fetchAbandonedSessions()
  }, [projectId])

  return (
    <MasonryGrid>
      {/* Show RecoverCard first if there are abandoned sessions */}
      {abandonedSessions.length > 0 && (
        <RecoverCard abandonedSessions={abandonedSessions} codeHref={codeHref} />
      )}
      <NowCard currentTask={currentTask} codeHref={codeHref} />
      <VelocityCard
        tasksPerDay={velocity}
        weeklyData={weeklyVelocityData}
        change={velocityChange}
        estimateAccuracy={estimateAccuracy}
      />
      <RoadmapCard roadmap={roadmap} codeHref={codeHref} />
      <QueueCard queue={queue} codeHref={codeHref} />
      <ShipsCard ships={shipped} totalShips={totalShips} codeHref={codeHref} />
      <StreakCard streak={streak} />
      <BlockersCard blockers={blockers} codeHref={codeHref} />
      <IdeasCard ideas={ideas} codeHref={codeHref} />
      <AgentsCard agents={agents} codeHref={codeHref} />
      <ActivityTimeline timeline={timeline} />
    </MasonryGrid>
  )
}
