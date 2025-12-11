'use client'

import { Flame, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StreakCardProps } from './StreakCard.types'

export function StreakCard({ streak, className }: StreakCardProps) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-card p-4',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Streak
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Flame className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="text-3xl font-bold tabular-nums">{streak}</p>
          <p className="text-xs text-muted-foreground">consecutive day{streak !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Last 7 days</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-2 flex-1 rounded-full transition-colors',
                i < streak ? 'bg-foreground' : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
