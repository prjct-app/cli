import { BentoCard } from '@/components/BentoCard'
import { EmptyState } from '@/components/EmptyState'
import { ListTodo, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPriorityColor } from './QueueCard.utils'
import type { QueueCardProps } from './QueueCard.types'

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
          {displayItems.map((item, i) => {
            const priorityColor = getPriorityColor(item.priority)
            return (
              <div key={i} className="flex items-start gap-2 group">
                <span className={cn(
                  "text-[10px] font-medium w-4 shrink-0 pt-0.5 tabular-nums",
                  priorityColor
                )}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-tight truncate group-hover:text-foreground transition-colors">
                    {item.task}
                  </p>
                  {(item.suggestedAgent || item.estimatedDuration) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.suggestedAgent && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
                          <Bot className="h-2.5 w-2.5" />
                          {item.suggestedAgent}
                        </span>
                      )}
                      {item.estimatedDuration && (
                        <span className="text-[9px] text-muted-foreground">
                          ~{item.estimatedDuration}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
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
