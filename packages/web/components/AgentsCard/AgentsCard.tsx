import { BentoCard } from '@/components/BentoCard'
import { EmptyState } from '@/components/EmptyState'
import { Bot, Star, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AgentsCardProps } from './AgentsCard.types'

export function AgentsCard({ agents, className }: AgentsCardProps) {
  const displayAgents = agents.slice(0, 8)

  return (
    <BentoCard
      size="1x1"
      title="Agents"
      icon={Bot}
      count={agents.length}
      className={className}
    >
      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents"
          description="Run /p:sync to generate"
          compact
        />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {displayAgents.map((agent) => {
            const hasPerformance = agent.successRate !== undefined
            const isTopPerformer = hasPerformance && agent.successRate! >= 80

            return (
              <Badge
                key={agent.name}
                variant="secondary"
                className={cn(
                  "text-xs px-2 py-0.5 font-mono inline-flex items-center gap-1",
                  isTopPerformer && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                )}
              >
                {isTopPerformer && <Star className="h-2.5 w-2.5" />}
                @{agent.name}
                {hasPerformance && (
                  <span className="text-[9px] opacity-70">
                    {agent.successRate}%
                  </span>
                )}
                {agent.improving && (
                  <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
                )}
              </Badge>
            )
          })}
          {agents.length > 8 && (
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              +{agents.length - 8}
            </Badge>
          )}
        </div>
      )}
    </BentoCard>
  )
}
