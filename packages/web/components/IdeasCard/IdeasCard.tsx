'use client'

import { EmptyState } from '@/components/EmptyState'
import { Lightbulb, Sparkles, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IdeasCardProps } from './IdeasCard.types'

export function IdeasCard({ ideas, codeHref, className }: IdeasCardProps) {
  const displayIdeas = ideas.slice(0, 8)
  const highImpactCount = ideas.filter(i => i.impact === 'HIGH').length
  const remaining = ideas.length - 8

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-card p-4',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Ideas
          </span>
        </div>
        <div className="flex items-center gap-2">
          {highImpactCount > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {highImpactCount} high impact
            </span>
          )}
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {ideas.length}
          </span>
        </div>
      </div>

      {ideas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No ideas yet"
          command="/p:idea"
          href={codeHref}
          compact
        />
      ) : (
        <div className="space-y-1">
          {displayIdeas.map((idea, i) => (
            <div key={i} className="flex items-start gap-2 py-1 group hover:bg-muted/50 rounded px-1 -mx-1">
              {idea.impact === 'HIGH' ? (
                <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
              ) : (
                <Lightbulb className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
              )}
              <p className={cn(
                'text-sm flex-1',
                idea.impact === 'HIGH' && 'font-medium'
              )}>
                {idea.title}
              </p>
              {idea.impact === 'HIGH' && (
                <ArrowUp className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
              )}
            </div>
          ))}
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground mt-2 pl-5 font-medium">
              +{remaining} more ideas
            </p>
          )}
        </div>
      )}
    </div>
  )
}
