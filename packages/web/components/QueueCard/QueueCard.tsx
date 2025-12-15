'use client'

import { useState } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/components/EmptyState'
import { ExpandButton } from '@/components/ExpandButton'
import { ListTodo, Bot, Play, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPriorityColor } from './QueueCard.utils'
import type { QueueCardProps } from './QueueCard.types'

const COLLAPSED_LIMIT = 10
const EXPANDED_LIMIT = 50

export function QueueCard({ queue, codeHref, className }: QueueCardProps) {
  const [expanded, setExpanded] = useState(false)
  const limit = expanded ? EXPANDED_LIMIT : COLLAPSED_LIMIT
  const displayItems = queue.slice(0, limit)
  const hasMore = queue.length > limit

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
            const startHref = codeHref
              ? `${codeHref}?cmd=${encodeURIComponent(`p. now "${item.task}"`)}`
              : undefined
            const deleteHref = codeHref
              ? `${codeHref}?cmd=${encodeURIComponent(`p. queue remove ${i + 1}`)}`
              : undefined

            return (
              <div
                key={i}
                className="flex items-start gap-2 group py-1.5 hover:bg-muted/50 rounded px-1 -mx-1"
              >
                <span className={cn(
                  "text-xs font-bold w-5 shrink-0 pt-0.5 tabular-nums",
                  priorityColor
                )}>
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-tight">
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
                {/* Always visible action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {startHref && (
                    <Link
                      href={startHref}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Start now"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {deleteHref && (
                    <Link
                      href={deleteHref}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Remove from queue"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
          {(hasMore || expanded) && queue.length > COLLAPSED_LIMIT && (
            <ExpandButton
              expanded={expanded}
              totalCount={queue.length}
              collapsedLimit={COLLAPSED_LIMIT}
              onToggle={() => setExpanded(!expanded)}
            />
          )}
        </div>
      )}
    </div>
  )
}
