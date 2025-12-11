'use client'

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
}: StatsMasonryProps) {
  const codeHref = `/project/${projectId}/code`

  return (
    <MasonryGrid>
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
    </MasonryGrid>
  )
}
