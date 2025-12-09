'use client'

import { BentoCard } from './BentoCard'
import { EmptyState } from './EmptyState'
import { ListTodo } from 'lucide-react'

interface QueueItem {
  task: string
  priority?: number
}

interface QueueCardProps {
  queue: QueueItem[]
  className?: string
}

export function QueueCard({ queue, className }: QueueCardProps) {
  const displayItems = queue.slice(0, 5)
  const remaining = queue.length - 5

  return (
    <BentoCard
      size="1x2"
      title="Queue"
      icon={ListTodo}
      count={queue.length}
      className={className}
    >
      {queue.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Queue empty"
          description="Plan your next tasks"
          command="/p:next"
          compact
        />
      ) : (
        <div className="space-y-2">
          {displayItems.map((item, i) => (
            <div key={i} className="flex items-start gap-2 group">
              <span className="text-[10px] font-medium text-muted-foreground w-4 shrink-0 pt-0.5 tabular-nums">
                {i + 1}
              </span>
              <p className="text-sm leading-tight truncate flex-1 group-hover:text-foreground transition-colors">
                {item.task}
              </p>
            </div>
          ))}
          {remaining > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2 pl-6">
              +{remaining} more
            </p>
          )}
        </div>
      )}
    </BentoCard>
  )
}
