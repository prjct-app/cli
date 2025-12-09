import type { UseQueryOptions } from '@tanstack/react-query'

// Refresh intervals in milliseconds
export const REFRESH_INTERVALS = {
  realtime: 2000,      // 2s - for active sessions, connection status
  fast: 5000,          // 5s - for project status, current task
  normal: 10000,       // 10s - for project list, stats
  slow: 30000,         // 30s - for historical data
} as const

// Default query options for different data freshness needs
export const queryPresets = {
  // For data that needs to feel "live" (sessions, connection status)
  realtime: {
    staleTime: 0,
    refetchInterval: REFRESH_INTERVALS.realtime,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },

  // For frequently changing data (project status, tasks)
  fast: {
    staleTime: REFRESH_INTERVALS.fast / 2,
    refetchInterval: REFRESH_INTERVALS.fast,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },

  // For moderately changing data (project list, stats)
  normal: {
    staleTime: REFRESH_INTERVALS.normal / 2,
    refetchInterval: REFRESH_INTERVALS.normal,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },

  // For rarely changing data (settings, historical)
  slow: {
    staleTime: REFRESH_INTERVALS.slow / 2,
    refetchInterval: REFRESH_INTERVALS.slow,
    refetchOnWindowFocus: true,
    refetchOnReconnect: false,
  },
} as const satisfies Record<string, Partial<UseQueryOptions>>
