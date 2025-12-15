'use client'

import Link from 'next/link'
import { EmptyState } from '@/components/EmptyState'
import { Map, ChevronRight, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RoadmapCardProps } from './RoadmapCard.types'

// Traffic light colors for progress: green=100%, yellow=50-99%, red=<50%
function getProgressColor(progress: number): string {
  if (progress >= 100) return 'bg-emerald-500'
  if (progress >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

export function RoadmapCard({ roadmap, codeHref, className }: RoadmapCardProps) {
  const hasPhases = roadmap?.phases && roadmap.phases.length > 0

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-card p-4',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Roadmap
          </span>
        </div>
        {hasPhases && (
          <span className="text-xs font-bold tabular-nums">
            {roadmap.progress}%
          </span>
        )}
      </div>

      {!hasPhases ? (
        <EmptyState
          icon={Map}
          title="No roadmap yet"
          description="Plan your features"
          command="/p:feature"
          href={codeHref}
        />
      ) : (
        <div className="space-y-4">
          {/* Overall progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Overall progress</span>
              <span className="text-sm font-bold tabular-nums">{roadmap.progress}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", getProgressColor(roadmap.progress))}
                style={{ width: `${roadmap.progress}%` }}
              />
            </div>
          </div>

          {/* Phases with features */}
          <div className="space-y-4">
            {roadmap.phases
              .filter(p => (p.features || []).length > 0)
              .slice(0, 6)
              .map((phase) => (
                <div key={phase.name} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {phase.progress === 100 ? (
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">
                        {phase.name}
                      </span>
                    </div>
                    <span className="text-xs font-bold tabular-nums shrink-0 ml-2 text-muted-foreground">
                      {phase.progress}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden ml-6">
                    <div
                      className={cn("h-full rounded-full transition-all duration-300", getProgressColor(phase.progress))}
                      style={{ width: `${phase.progress}%` }}
                    />
                  </div>
                  {/* Show features under each phase */}
                  {phase.features && phase.features.length > 0 && (
                    <div className="ml-6 mt-2 space-y-1">
                      {phase.features.slice(0, 3).map((feature, i) => {
                        const isCompleted = feature.status === 'completed'
                        const cmdHref = codeHref && !isCompleted
                          ? `${codeHref}?cmd=${encodeURIComponent(`p. work "${feature.name}"`)}`
                          : undefined

                        const content = (
                          <>
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            <span className={cn(
                              'truncate',
                              isCompleted && 'line-through opacity-60'
                            )}>
                              {feature.name}
                            </span>
                          </>
                        )

                        return cmdHref ? (
                          <Link
                            key={i}
                            href={cmdHref}
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer"
                          >
                            {content}
                          </Link>
                        ) : (
                          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                            {content}
                          </div>
                        )
                      })}
                      {phase.features.length > 3 && (
                        <span className="text-xs text-muted-foreground/70 ml-5">
                          +{phase.features.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>

          {roadmap.phases.length > 0 && (
            <p className="text-xs text-muted-foreground border-t pt-3 mt-3">
              {roadmap.phases.reduce((acc, p) => acc + (p.features?.length || 0), 0)} features across {roadmap.phases.length} phases
            </p>
          )}
        </div>
      )}
    </div>
  )
}
