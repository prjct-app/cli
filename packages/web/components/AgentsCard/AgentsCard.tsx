'use client'

import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { ExpandButton } from '@/components/ExpandButton'
import { Bot, Star, TrendingUp, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AgentsCardProps } from './AgentsCard.types'

const COLLAPSED_LIMIT = 12

export function AgentsCard({ agents, codeHref, className }: AgentsCardProps) {
  const [expanded, setExpanded] = useState(false)
  const displayAgents = expanded ? agents : agents.slice(0, COLLAPSED_LIMIT)
  const hasMore = agents.length > COLLAPSED_LIMIT

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-card p-4',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Agents
          </span>
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {agents.length} available
        </span>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents"
          description="Run /p:sync to generate"
          command="/p:sync"
          href={codeHref}
          compact
        />
      ) : (
        <div className="space-y-2">
          {displayAgents.map((agent) => {
            const hasPerformance = agent.successRate !== undefined
            const isTopPerformer = hasPerformance && agent.successRate! >= 80

            return (
              <div
                key={agent.name}
                className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg -mx-2 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isTopPerformer ? (
                    <Star className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-mono text-sm truncate">@{agent.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasPerformance && (
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {agent.successRate}%
                    </span>
                  )}
                  {agent.improving && (
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                  )}
                  {agent.tasksCompleted !== undefined && agent.tasksCompleted > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                      {agent.tasksCompleted} tasks
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
          {hasMore && (
            <ExpandButton
              expanded={expanded}
              totalCount={agents.length}
              collapsedLimit={COLLAPSED_LIMIT}
              onToggle={() => setExpanded(!expanded)}
            />
          )}
        </div>
      )}
    </div>
  )
}
