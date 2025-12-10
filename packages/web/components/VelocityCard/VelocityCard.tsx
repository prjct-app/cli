import { BentoCard } from '@/components/BentoCard'
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

        <div className="flex items-center justify-between mt-2">
          {change !== 0 && (
            <div className="flex items-center gap-1">
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

          {estimateAccuracy !== undefined && estimateAccuracy > 0 && (
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-muted-foreground" />
              <span
                className={cn(
                  'text-xs font-medium',
                  estimateAccuracy >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
                  estimateAccuracy >= 40 ? 'text-amber-600 dark:text-amber-400' :
                  'text-muted-foreground'
                )}
              >
                {estimateAccuracy}% acc
              </span>
            </div>
          )}
        </div>
      </div>
    </BentoCard>
  )
}
