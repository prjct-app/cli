import { BentoCard } from '@/components/BentoCard'
import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STREAK_HOT_THRESHOLD, STREAK_ON_FIRE_THRESHOLD } from './StreakCard.constants'
import type { StreakCardProps } from './StreakCard.types'

export function StreakCard({ streak, className }: StreakCardProps) {
  const isHot = streak >= STREAK_HOT_THRESHOLD
  const isOnFire = streak >= STREAK_ON_FIRE_THRESHOLD

  return (
    <BentoCard
      size="1x1"
      title="Streak"
      icon={Flame}
      accentColor={isOnFire ? 'warning' : 'default'}
      className={className}
    >
      <div className="flex flex-col h-full justify-between">
        <div className="flex items-center gap-3">
          <Flame
            className={cn(
              'h-8 w-8 transition-colors',
              isOnFire ? 'text-orange-500' : isHot ? 'text-amber-500' : 'text-muted-foreground'
            )}
          />
          <div>
            <p className="text-3xl font-bold tabular-nums">{streak}</p>
            <p className="text-xs text-muted-foreground">day{streak !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex gap-1 mt-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i < streak
                  ? isOnFire
                    ? 'bg-orange-500'
                    : isHot
                    ? 'bg-amber-500'
                    : 'bg-foreground'
                  : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>
    </BentoCard>
  )
}
