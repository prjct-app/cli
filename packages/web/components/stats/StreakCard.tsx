'use client'

import { BentoCard } from './BentoCard'
import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StreakCardProps {
  streak: number
  className?: string
}

export function StreakCard({ streak, className }: StreakCardProps) {
  const isHot = streak >= 3
  const isOnFire = streak >= 7

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

        {/* Visual streak indicator - dots */}
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
