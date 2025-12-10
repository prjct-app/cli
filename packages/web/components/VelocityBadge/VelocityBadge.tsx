import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VelocityBadgeProps } from './VelocityBadge.types'

export function VelocityBadge({ change }: VelocityBadgeProps) {
  if (change === 0) return null

  const isPositive = change >= 0
  const Icon = isPositive ? TrendingUp : TrendingDown

  return (
    <div className="flex items-center gap-2 mt-2">
      <span
        className={cn(
          'inline-flex items-center gap-1 text-xs sm:text-sm font-medium px-2 py-0.5 rounded-md',
          isPositive
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        {isPositive ? '+' : ''}{change}%
      </span>
      <span className="text-xs sm:text-sm text-muted-foreground">vs last week</span>
    </div>
  )
}
