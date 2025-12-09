'use client'

import { useQuery } from '@tanstack/react-query'
import { queryPresets } from '@/lib/query-config'

export interface Stats {
  userName?: string
  totalProjects?: number
  activeProjects?: number
  totalSessions?: number
  sessionsThisWeek?: number
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!res.ok) throw new Error('Failed to fetch stats')
      const json = await res.json()
      return json.data as Stats
    },
    ...queryPresets.normal,
  })
}
