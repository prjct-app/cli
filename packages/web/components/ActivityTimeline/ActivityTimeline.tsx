'use client'

import { Activity } from 'lucide-react'
import { BentoCard } from '@/components/BentoCard'
import { EmptyState } from '@/components/EmptyState'
import { DateGroup } from '@/components/DateGroup'
import { ExpandButton } from '@/components/ExpandButton'
import { useExpandable, useGroupedEvents } from './hooks'
import { TIMELINE_COLLAPSED_LIMIT, TIMELINE_EXPANDED_LIMIT } from './ActivityTimeline.constants'
import type { ActivityTimelineProps } from './ActivityTimeline.types'

export function ActivityTimeline({ timeline, className }: ActivityTimelineProps) {
  const { expanded, toggle } = useExpandable(false)
  const limit = expanded ? TIMELINE_EXPANDED_LIMIT : TIMELINE_COLLAPSED_LIMIT
  const { grouped, hasMore } = useGroupedEvents(timeline, limit)

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
        <div className="space-y-3 sm:space-y-4">
          {Array.from(grouped.entries()).map(([dateKey, events]) => (
            <DateGroup key={dateKey} dateKey={dateKey} events={events} />
          ))}

          {hasMore && (
            <ExpandButton
              expanded={expanded}
              totalCount={timeline.length}
              collapsedLimit={TIMELINE_COLLAPSED_LIMIT}
              onToggle={toggle}
            />
          )}
        </div>
      )}
    </BentoCard>
  )
}
