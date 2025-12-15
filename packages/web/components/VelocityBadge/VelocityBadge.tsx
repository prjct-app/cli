import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VelocityBadgeProps } from './VelocityBadge.types'

function getChangeColor(change: number): string {
  if (change >= 10) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  if (change >= 0) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  if (change >= -10) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  return 'bg-red-500/10 text-red-600 dark:text-red-400'
}

export function VelocityBadge({ change }: VelocityBadgeProps) {
  if (change === 0) return null

  const isPositive = change >= 0
  const Icon = isPositive ? TrendingUp : TrendingDown

  return (
    <div className="flex items-center gap-2 mt-2">
      <span
        className={cn(
          'inline-flex items-center gap-1 text-xs sm:text-sm font-medium px-2 py-0.5 rounded-md',
          getChangeColor(change)
        )}
      >
        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        {isPositive ? '+' : ''}{change}%
      </span>
      <span className="text-xs sm:text-sm text-muted-foreground">vs last week</span>
    </div>
  )
}
