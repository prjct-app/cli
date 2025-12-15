'use client'

import { useState } from 'react'
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { ExpandButton } from '@/components/ExpandButton'
import { cn } from '@/lib/utils'
import type { BlockersCardProps } from './BlockersCard.types'

const COLLAPSED_LIMIT = 5

export function BlockersCard({ blockers, codeHref, className }: BlockersCardProps) {
  const [expanded, setExpanded] = useState(false)
  const hasBlockers = blockers.length > 0
  const displayBlockers = expanded ? blockers : blockers.slice(0, COLLAPSED_LIMIT)
  const hasMore = blockers.length > COLLAPSED_LIMIT

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-card p-4',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Blockers
          </span>
        </div>
        {hasBlockers && (
          <span className="text-xs font-bold text-muted-foreground tabular-nums">
            {blockers.length}
          </span>
        )}
      </div>

      {!hasBlockers ? (
        <div className="flex items-center gap-3 py-2">
          <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">No blockers</p>
            <p className="text-xs text-muted-foreground">Keep the momentum</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {displayBlockers.map((blocker, i) => (
            <div
              key={i}
              className="p-2.5 rounded-lg bg-muted/50 border"
            >
              <p className="text-sm font-medium">{blocker.task}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {blocker.reason}
              </p>
              <div className="flex items-center gap-1 mt-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {blocker.daysBlocked} day{blocker.daysBlocked !== 1 ? 's' : ''} blocked
                </span>
              </div>
            </div>
          ))}
          {hasMore && (
            <ExpandButton
              expanded={expanded}
              totalCount={blockers.length}
              collapsedLimit={COLLAPSED_LIMIT}
              onToggle={() => setExpanded(!expanded)}
            />
          )}
        </div>
      )}
    </div>
  )
}
