/**
 * Project Manager
 *
 * Manages project.json - project metadata.
 */

import { BaseManager } from './base-manager'
import type { ProjectSchema } from '../schemas'
import { DEFAULT_PROJECT } from '../schemas'

class ProjectManager extends BaseManager<ProjectSchema> {
  constructor() {
    super('project.json')
  }

  protected getDefault(projectId: string): ProjectSchema {
    return {
      ...DEFAULT_PROJECT,
      projectId,
      name: '',
      repoPath: '',
      createdAt: new Date().toISOString(),
      lastSync: new Date().toISOString()
    }
  }

  async getProject(projectId: string): Promise<ProjectSchema> {
    return this.read(projectId)
  }

  async updateProject(
    projectId: string,
    updates: Partial<Omit<ProjectSchema, 'projectId'>>
  ): Promise<ProjectSchema> {
    return this.update(projectId, (project) => ({
      ...project,
      ...updates,
      lastSync: new Date().toISOString()
    }))
  }

  async setTechStack(projectId: string, techStack: string[]): Promise<ProjectSchema> {
    return this.updateProject(projectId, { techStack })
  }

  async setFileCount(projectId: string, fileCount: number): Promise<ProjectSchema> {
    return this.updateProject(projectId, { fileCount })
  }

  async setCommitCount(projectId: string, commitCount: number): Promise<ProjectSchema> {
    return this.updateProject(projectId, { commitCount })
  }

  async initializeProject(
    projectId: string,
    name: string,
    repoPath: string,
    options?: Partial<ProjectSchema>
  ): Promise<ProjectSchema> {
    const project: ProjectSchema = {
      ...DEFAULT_PROJECT,
      ...options,
      projectId,
      name,
      repoPath,
      createdAt: new Date().toISOString(),
      lastSync: new Date().toISOString()
    }
    await this.write(projectId, project)
    return project
  }
}

export const projectManager = new ProjectManager()
export default projectManager
