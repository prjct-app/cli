/**
 * Projects Service (Server-only)
 *
 * Direct data access for Server Components.
 * No API calls needed - reads directly from filesystem.
 */

import 'server-only'
import { cache } from 'react'
import { loadProject, type ProjectJson } from '@/lib/json-loader'
import { getProjects as getProjectsList, getProject as getProjectLegacy } from '@/lib/projects'

export type { ProjectJson }

/**
 * Get single project by ID - cached per request
 */
export const getProject = cache(async (projectId: string): Promise<ProjectJson | null> => {
  // Try JSON first
  const jsonProject = await loadProject(projectId)
  if (jsonProject) {
    return jsonProject
  }

  // Fallback to legacy
  try {
    const legacyProject = await getProjectLegacy(projectId)
    if (legacyProject) {
      return {
        projectId: legacyProject.id,
        name: legacyProject.name,
        repoPath: legacyProject.path,
        techStack: legacyProject.techStack || [],
        fileCount: legacyProject.filesCount ? parseInt(legacyProject.filesCount) : 0,
        commitCount: legacyProject.commitsCount ? parseInt(legacyProject.commitsCount) : 0,
        createdAt: new Date().toISOString(),
        lastSync: new Date().toISOString()
      }
    }
  } catch {
    // Ignore errors
  }

  return null
})

/**
 * Get all projects - cached per request
 */
export const getProjects = cache(async () => {
  return getProjectsList()
})
