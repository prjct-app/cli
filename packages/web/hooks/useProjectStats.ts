'use client'

import { useQuery } from '@tanstack/react-query'
import type { ProjectStats, RawProjectFiles } from '@/lib/parse-prjct-files'

interface ProjectStatsResponse {
  success: boolean
  data?: ProjectStats
  raw?: RawProjectFiles
  error?: string
}

interface ProjectStatsData {
  stats: ProjectStats
  raw: RawProjectFiles
}

async function fetchProjectStats(projectId: string): Promise<ProjectStatsData> {
  const res = await fetch(`/api/projects/${projectId}/stats`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch project stats')
  const json: ProjectStatsResponse = await res.json()
  if (!json.success || !json.data || !json.raw) {
    throw new Error(json.error || 'Failed to fetch project stats')
  }
  return { stats: json.data, raw: json.raw }
}

export function useProjectStats(projectId: string) {
  return useQuery({
    queryKey: ['project-stats', projectId],
    queryFn: () => fetchProjectStats(projectId),
    staleTime: 30_000, // Cache 30s
    refetchOnWindowFocus: true,
    enabled: !!projectId,
  })
}
