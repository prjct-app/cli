'use client'

import { BentoCard } from './BentoCard'
import { EmptyState } from './EmptyState'
import { Map } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RoadmapPhase {
  name: string
  progress: number
  features?: { name: string; status: string }[]
}

interface RoadmapData {
  phases: RoadmapPhase[]
  progress: number
}

interface RoadmapCardProps {
  roadmap: RoadmapData | null
  className?: string
}

export function RoadmapCard({ roadmap, className }: RoadmapCardProps) {
  const hasPhases = roadmap?.phases && roadmap.phases.length > 0

  return (
    <BentoCard
      size="2x2"
      title="Roadmap"
      icon={Map}
      count={hasPhases ? `${roadmap.progress}%` : undefined}
      className={className}
    >
      {!hasPhases ? (
        <EmptyState
          icon={Map}
          title="No roadmap yet"
          description="Plan your features"
          command="/p:feature"
        />
      ) : (
        <div className="flex flex-col h-full">
          {/* Overall progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Overall progress</span>
              <span className="font-bold tabular-nums">{roadmap.progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  roadmap.progress === 100 ? 'bg-emerald-500' : 'bg-foreground'
                )}
                style={{ width: `${roadmap.progress}%` }}
              />
            </div>
          </div>

          {/* Phases */}
          <div className="space-y-3 flex-1">
            {roadmap.phases
              .filter(p => (p.features || []).length > 0)
              .slice(0, 4)
              .map((phase) => (
                <div key={phase.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium truncate">{phase.name}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                      {phase.progress}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        phase.progress === 100 ? 'bg-emerald-500' : 'bg-foreground/70'
                      )}
                      style={{ width: `${phase.progress}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>

          {/* Feature count */}
          {roadmap.phases.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-3">
              {roadmap.phases.reduce((acc, p) => acc + (p.features?.length || 0), 0)} features across {roadmap.phases.length} phases
            </p>
          )}
        </div>
      )}
    </BentoCard>
  )
}
