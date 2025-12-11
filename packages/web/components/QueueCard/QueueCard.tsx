'use client'

import { EmptyState } from '@/components/EmptyState'
import { ListTodo, Bot, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPriorityColor } from './QueueCard.utils'
import type { QueueCardProps } from './QueueCard.types'

export function QueueCard({ queue, codeHref, className }: QueueCardProps) {
  const displayItems = queue.slice(0, 10)
  const remaining = queue.length - 10

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-card p-4',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Queue
          </span>
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {queue.length} tasks
        </span>
      </div>

      {queue.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Queue empty"
          description="Plan your next tasks"
          command="/p:next"
          href={codeHref}
          compact
        />
      ) : (
        <div className="space-y-1.5">
          {displayItems.map((item, i) => {
            const priorityColor = getPriorityColor(item.priority)
            return (
              <div key={i} className="flex items-start gap-2 group py-1 hover:bg-muted/50 rounded px-1 -mx-1">
                <span className={cn(
                  "text-xs font-bold w-5 shrink-0 pt-0.5 tabular-nums",
                  priorityColor
                )}>
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-tight group-hover:text-foreground transition-colors">
                    {item.task}
                  </p>
                  {(item.suggestedAgent || item.estimatedDuration) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.suggestedAgent && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Bot className="h-3 w-3" />
                          {item.suggestedAgent}
                        </span>
                      )}
                      {item.estimatedDuration && (
                        <span className="text-xs text-muted-foreground">
                          ~{item.estimatedDuration}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
              </div>
            )
          })}
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground mt-2 pl-6 font-medium">
              +{remaining} more in backlog
            </p>
          )}
        </div>
      )}
    </div>
  )
}
