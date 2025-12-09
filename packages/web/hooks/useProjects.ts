'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryPresets } from '@/lib/query-config'

export interface Project {
  id: string
  name: string
  path: string
  repoPath?: string | null
  currentTask?: string | null
  hasActiveSession?: boolean
  lastActivity?: string | null
  ideasCount?: number
  nextTasksCount?: number
  techStack?: string[]
  iconPath?: string | null
  version?: string
  stack?: string
  filesCount?: number
  commitsCount?: number
}

// Fetch with no-cache headers for fresh data
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
    },
  })
  if (!res.ok) throw new Error(`Failed to fetch ${url}`)
  const json = await res.json()
  return json.data ?? json
}

// Hook for fetching all projects
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchJson<Project[]>('/api/projects'),
    ...queryPresets.normal,
  })
}

// Hook for fetching a single project
export function useProject(projectId: string | null) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchJson<Project>(`/api/projects/${projectId}`),
    enabled: !!projectId,
    ...queryPresets.fast,
  })
}

// Hook for deleting a project
export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/projects/${projectId}/delete`, { method: 'POST' })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete project')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
