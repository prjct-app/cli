'use client'

import { SparklineChart } from '@/components/SparklineChart'
import { Zap, TrendingUp, TrendingDown, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VelocityCardProps } from './VelocityCard.types'

export function VelocityCard({
  tasksPerDay,
  weeklyData = [],
  change = 0,
  estimateAccuracy,
  className,
}: VelocityCardProps) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-card p-4',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Velocity
          </span>
        </div>
        {change !== 0 && (
          <div className="flex items-center gap-1">
            {change >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-xs font-bold text-muted-foreground">
              {change >= 0 ? '+' : ''}{change}%
            </span>
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-bold tabular-nums">{tasksPerDay}</p>
          <p className="text-xs text-muted-foreground">tasks/day avg</p>
        </div>

        {weeklyData.length > 0 && (
          <div className="flex-1 max-w-[120px]">
            <SparklineChart data={weeklyData} height={40} />
            <p className="text-xs text-muted-foreground text-right mt-1">Last 7 days</p>
          </div>
        )}
      </div>

      {estimateAccuracy !== undefined && estimateAccuracy > 0 && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t">
          <Target className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Estimate accuracy:</span>
          <span className="text-xs font-bold text-muted-foreground">
            {estimateAccuracy}%
          </span>
        </div>
      )}
    </div>
  )
}
