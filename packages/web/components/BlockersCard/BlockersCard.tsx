'use client'

import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BlockersCardProps } from './BlockersCard.types'

export function BlockersCard({ blockers, codeHref, className }: BlockersCardProps) {
  const hasBlockers = blockers.length > 0

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
          {blockers.slice(0, 5).map((blocker, i) => (
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
          {blockers.length > 5 && (
            <p className="text-xs text-muted-foreground font-medium">
              +{blockers.length - 5} more blockers
            </p>
          )}
        </div>
      )}
    </div>
  )
}
