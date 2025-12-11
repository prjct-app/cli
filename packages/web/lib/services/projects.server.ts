/**
 * Projects Service (Server-only)
 *
 * MD-First Architecture: Reads directly from MD files.
 * No JSON fallback - MD is the source of truth.
 */

import 'server-only'
import { cache } from 'react'
import { getProjects as getProjectsList, getProject as getMdProject } from '@/lib/projects'

// Types for project data
export interface ProjectJson {
  projectId: string
  name: string
  repoPath?: string | null
  techStack: string[]
  fileCount: number
  commitCount: number
  createdAt: string
  lastSync: string
  version?: string | null
}

/**
 * Get single project by ID - cached per request
 *
 * MD-First: Uses MD files as source of truth
 */
export const getProject = cache(async (projectId: string): Promise<ProjectJson | null> => {
  try {
    const project = await getMdProject(projectId)
    if (project) {
      return {
        projectId: project.id,
        name: project.name,
        repoPath: project.repoPath,
        techStack: project.techStack || [],
        fileCount: project.filesCount ? parseInt(project.filesCount) : 0,
        commitCount: project.commitsCount ? parseInt(project.commitsCount) : 0,
        createdAt: new Date().toISOString(),
        lastSync: new Date().toISOString(),
        version: project.version || null
      }
    }
  } catch {
    // Project not found
  }

  return null
})

/**
 * Get all projects - cached per request
 */
export const getProjects = cache(async () => {
  return getProjectsList()
})
