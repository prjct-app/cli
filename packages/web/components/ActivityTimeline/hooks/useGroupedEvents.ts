'use client'

import { useMemo } from 'react'
import type { TimelineEvent } from '../ActivityTimeline.types'

export function useGroupedEvents(events: TimelineEvent[], limit: number) {
  return useMemo(() => {
    const displayEvents = events.slice(0, limit)
    const groups = new Map<string, TimelineEvent[]>()

    displayEvents.forEach(event => {
      if (!event.ts) return
      const dateKey = event.ts.split('T')[0]
      const existing = groups.get(dateKey) ?? []
      groups.set(dateKey, [...existing, event])
    })

    return {
      grouped: groups,
      hasMore: events.length > limit,
    }
  }, [events, limit])
}
