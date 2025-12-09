'use client'

import { useMemo, useState } from 'react'
import { BentoCard } from './BentoCard'
import { EmptyState } from './EmptyState'
import { Activity, CheckCircle2, Rocket, Target, RefreshCw, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { TimelineEvent } from '@/lib/parse-prjct-files'

interface ActivityTimelineProps {
  timeline: TimelineEvent[]
  className?: string
}

function getEventIcon(type: string) {
  switch (type) {
    case 'task_complete':
      return CheckCircle2
    case 'task_start':
      return Target
    case 'feature_ship':
      return Rocket
    case 'sync':
      return RefreshCw
    default:
      return Activity
  }
}

function getEventColor(type: string) {
  switch (type) {
    case 'task_complete':
      return 'text-emerald-500'
    case 'task_start':
      return 'text-amber-500'
    case 'feature_ship':
      return 'text-blue-500'
    case 'sync':
      return 'text-muted-foreground'
    default:
      return 'text-muted-foreground'
  }
}

function getEventLabel(event: TimelineEvent): string {
  const e = event as Record<string, unknown>
  switch (event.type) {
    case 'task_complete':
      return (e.task as string) || 'Task completed'
    case 'task_start':
      return (e.task as string) || 'Task started'
    case 'feature_ship':
      return (e.name as string) || 'Feature shipped'
    case 'sync':
      return 'Project synced'
    default:
      return event.type
  }
}

function getEventBadge(type: string): string {
  switch (type) {
    case 'task_complete':
      return 'DONE'
    case 'task_start':
      return 'START'
    case 'feature_ship':
      return 'SHIP'
    case 'sync':
      return 'SYNC'
    default:
      return type.toUpperCase()
  }
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Group events by date
function groupEventsByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>()

  events.forEach(event => {
    if (!event.ts) return
    const dateKey = event.ts.split('T')[0]
    const existing = groups.get(dateKey) || []
    groups.set(dateKey, [...existing, event])
  })

  return groups
}

export function ActivityTimeline({ timeline, className }: ActivityTimelineProps) {
  const [showAll, setShowAll] = useState(false)

  const displayEvents = showAll ? timeline.slice(0, 20) : timeline.slice(0, 8)
  const groupedEvents = useMemo(() => groupEventsByDate(displayEvents), [displayEvents])
  const hasMore = timeline.length > displayEvents.length

  return (
    <BentoCard
      size="full"
      title="Recent Activity"
      icon={Activity}
      count={timeline.length > 0 ? `${timeline.length} events` : undefined}
      className={className}
    >
      {timeline.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No recent activity"
          description="Activity will appear as you work"
          compact
        />
      ) : (
        <div className="space-y-4">
          {Array.from(groupedEvents.entries()).map(([dateKey, events]) => (
            <div key={dateKey}>
              {/* Date header */}
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {formatDate(dateKey + 'T00:00:00')}
              </p>

              {/* Events for this date */}
              <div className="space-y-1">
                {events.map((event, i) => {
                  const Icon = getEventIcon(event.type)
                  const e = event as Record<string, unknown>

                  const duration = typeof e.duration === 'string' ? e.duration : null

                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors group"
                    >
                      {/* Time */}
                      {event.ts && (
                        <span className="text-[10px] text-muted-foreground w-14 shrink-0 tabular-nums">
                          {formatTime(event.ts)}
                        </span>
                      )}

                      {/* Icon */}
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', getEventColor(event.type))} />

                      {/* Label */}
                      <span className="text-sm truncate flex-1 group-hover:text-foreground transition-colors">
                        {getEventLabel(event)}
                      </span>

                      {/* Badge */}
                      <span className="text-[9px] font-bold tracking-wider text-muted-foreground shrink-0">
                        {getEventBadge(event.type)}
                      </span>

                      {/* Duration if available */}
                      {duration && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {duration}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Load more button */}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="w-full text-muted-foreground"
            >
              <ChevronDown className={cn('h-4 w-4 mr-1 transition-transform', showAll && 'rotate-180')} />
              {showAll ? 'Show less' : `Show ${timeline.length - 8} more`}
            </Button>
          )}
        </div>
      )}
    </BentoCard>
  )
}
