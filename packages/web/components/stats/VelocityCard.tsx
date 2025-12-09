'use client'

import { BentoCard } from './BentoCard'
import { SparklineChart } from './SparklineChart'
import { Zap, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VelocityCardProps {
  tasksPerDay: number
  weeklyData?: number[]
  change?: number
  className?: string
}

export function VelocityCard({
  tasksPerDay,
  weeklyData = [],
  change = 0,
  className,
}: VelocityCardProps) {
  return (
    <BentoCard
      size="1x1"
      title="Velocity"
      icon={Zap}
      className={className}
    >
      <div className="flex flex-col h-full justify-between">
        <div>
          <p className="text-3xl font-bold tabular-nums">{tasksPerDay}</p>
          <p className="text-xs text-muted-foreground">tasks/day</p>
        </div>

        {weeklyData.length > 0 && (
          <div className="mt-2">
            <SparklineChart data={weeklyData} height={28} />
          </div>
        )}

        {change !== 0 && (
          <div className="flex items-center gap-1 mt-2">
            {change >= 0 ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-muted-foreground" />
            )}
            <span
              className={cn(
                'text-xs font-medium',
                change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              )}
            >
              {change >= 0 ? '+' : ''}{change}%
            </span>
          </div>
        )}
      </div>
    </BentoCard>
  )
}
