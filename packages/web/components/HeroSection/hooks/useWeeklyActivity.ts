'use client'

import { useMemo } from 'react'
import type { TimelineEvent } from '../HeroSection.types'

export function useWeeklyActivity(timeline: TimelineEvent[]): number[] {
  return useMemo(() => {
    const today = new Date()

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today)
      date.setDate(date.getDate() - (6 - i))
      const dateStr = date.toISOString().split('T')[0]

      return timeline.filter(e => e.ts?.startsWith(dateStr)).length
    })
  }, [timeline])
}
