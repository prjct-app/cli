import { BentoCard } from '@/components/BentoCard'
import { AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BlockersCardProps } from './BlockersCard.types'

export function BlockersCard({ blockers, className }: BlockersCardProps) {
  const hasBlockers = blockers.length > 0

  return (
    <BentoCard
      size="1x1"
      title="Blockers"
      icon={AlertTriangle}
      className={cn(
        hasBlockers && 'border-amber-500/50 dark:border-amber-500/30',
        className
      )}
    >
      <div className="flex flex-col h-full">
        {!hasBlockers ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-2xl mb-1">&#x2705;</div>
            <p className="text-sm text-muted-foreground">No blockers</p>
            <p className="text-xs text-muted-foreground mt-1">Keep the momentum!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {blockers.length}
              </span>
              <span className="text-xs text-muted-foreground">
                {blockers.length === 1 ? 'task blocked' : 'tasks blocked'}
              </span>
            </div>

            <div className="flex-1 overflow-auto space-y-2">
              {blockers.slice(0, 3).map((blocker, i) => (
                <div
                  key={i}
                  className="p-2 rounded-md bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20"
                >
                  <p className="text-xs font-medium truncate">{blocker.task}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {blocker.reason}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {blocker.daysBlocked}d
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {blockers.length > 3 && (
              <p className="text-xs text-muted-foreground mt-2">
                +{blockers.length - 3} more
              </p>
            )}
          </>
        )}
      </div>
    </BentoCard>
  )
}
