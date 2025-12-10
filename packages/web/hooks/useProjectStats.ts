'use client'

import { useQuery } from '@tanstack/react-query'
import type { ProjectStats, RawProjectFiles } from '@/lib/parse-prjct-files'
import type {
  UnifiedApiResponse,
  ProjectState,
  OutcomeSummary,
  AgentPerformance,
  ProjectInsights,
} from '@prjct/shared'

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

// Legacy fetch
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

// ============== Unified API ==============

interface UnifiedProjectData {
  state: ProjectState | null
  outcomes: OutcomeSummary | null
  agentPerformance: AgentPerformance[]
  insights: ProjectInsights
  legacyFallback: boolean
  // Legacy data when fallback
  legacyData?: ProjectStats
  legacyRaw?: RawProjectFiles
}

async function fetchUnifiedProjectData(projectId: string): Promise<UnifiedProjectData> {
  const res = await fetch(`/api/v2/projects/${projectId}/unified`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch unified project data')
  const json: UnifiedApiResponse = await res.json()
  if (!json.success) {
    throw new Error('Failed to fetch unified project data')
  }
  return {
    state: json.state,
    outcomes: json.outcomes,
    agentPerformance: json.agentPerformance,
    insights: json.insights,
    legacyFallback: json.legacyFallback,
    legacyData: json.legacyData as ProjectStats | undefined,
    legacyRaw: json.legacyRaw as RawProjectFiles | undefined,
  }
}

/**
 * Hook for fetching unified project data from v2 API.
 * Falls back to legacy data if unified state doesn't exist.
 */
export function useUnifiedProjectStats(projectId: string) {
  return useQuery({
    queryKey: ['project-unified', projectId],
    queryFn: () => fetchUnifiedProjectData(projectId),
    staleTime: 30_000, // Cache 30s
    refetchOnWindowFocus: true,
    enabled: !!projectId,
  })
}
