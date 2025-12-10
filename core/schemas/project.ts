/**
 * Project Schema
 *
 * Defines the structure for project.json - project metadata.
 */

export interface ProjectSchema {
  projectId: string
  name: string
  repoPath: string
  description?: string
  version?: string
  techStack: string[]
  fileCount: number
  commitCount: number
  createdAt: string // ISO8601
  lastSync: string // ISO8601
}

export const DEFAULT_PROJECT: Omit<ProjectSchema, 'projectId' | 'name' | 'repoPath'> = {
  techStack: [],
  fileCount: 0,
  commitCount: 0,
  createdAt: new Date().toISOString(),
  lastSync: new Date().toISOString()
}
