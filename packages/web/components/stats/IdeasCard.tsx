'use client'

import { BentoCard } from './BentoCard'
import { EmptyState } from './EmptyState'
import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Idea {
  title: string
  impact?: string
}

interface IdeasCardProps {
  ideas: Idea[]
  className?: string
}

export function IdeasCard({ ideas, className }: IdeasCardProps) {
  const displayIdeas = ideas.slice(0, 4)
  const highImpactCount = ideas.filter(i => i.impact === 'HIGH').length

  return (
    <BentoCard
      size="1x1"
      title="Ideas"
      icon={Lightbulb}
      count={ideas.length}
      className={className}
    >
      {ideas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No ideas yet"
          command="/p:idea"
          compact
        />
      ) : (
        <div className="space-y-1.5">
          {displayIdeas.map((idea, i) => (
            <div key={i} className="flex items-start gap-2">
              <Lightbulb
                className={cn(
                  'h-3 w-3 mt-0.5 shrink-0',
                  idea.impact === 'HIGH' ? 'text-amber-500' : 'text-muted-foreground'
                )}
              />
              <p className="text-sm truncate">{idea.title}</p>
            </div>
          ))}
          {highImpactCount > 0 && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 pl-5 font-medium">
              {highImpactCount} high impact
            </p>
          )}
        </div>
      )}
    </BentoCard>
  )
}
