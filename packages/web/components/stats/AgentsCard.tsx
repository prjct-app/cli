'use client'

import { BentoCard } from './BentoCard'
import { EmptyState } from './EmptyState'
import { Bot } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Agent {
  name: string
  description?: string
}

interface AgentsCardProps {
  agents: Agent[]
  className?: string
}

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
          {displayAgents.map((agent) => (
            <Badge
              key={agent.name}
              variant="secondary"
              className="text-xs px-2 py-0.5 font-mono"
            >
              @{agent.name}
            </Badge>
          ))}
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
