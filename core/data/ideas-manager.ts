/**
 * Ideas Manager
 *
 * Manages ideas.json - idea backlog.
 */

import { ArrayManager } from './base-manager'
import type { IdeaSchema, IdeasSchema, IdeaPriority } from '../schemas'
import { DEFAULT_IDEA } from '../schemas'

class IdeasManager extends ArrayManager<IdeaSchema> {
  constructor() {
    super('ideas.json')
  }

  async getIdeas(projectId: string): Promise<IdeasSchema> {
    return this.read(projectId)
  }

  async getPendingIdeas(projectId: string): Promise<IdeasSchema> {
    const ideas = await this.read(projectId)
    return ideas.filter((idea) => idea.status === 'pending')
  }

  async getIdea(projectId: string, id: string): Promise<IdeaSchema | undefined> {
    return this.find(projectId, (idea) => idea.id === id)
  }

  async addIdea(
    projectId: string,
    content: string,
    options?: Partial<Omit<IdeaSchema, 'id' | 'content' | 'createdAt'>>
  ): Promise<IdeasSchema> {
    const idea: IdeaSchema = {
      ...DEFAULT_IDEA,
      ...options,
      id: `idea_${Date.now()}`,
      content,
      createdAt: new Date().toISOString()
    }
    return this.add(projectId, idea)
  }

  async updateIdea(
    projectId: string,
    id: string,
    updates: Partial<Omit<IdeaSchema, 'id' | 'createdAt'>>
  ): Promise<IdeasSchema> {
    return this.updateItem(
      projectId,
      (idea) => idea.id === id,
      (idea) => ({ ...idea, ...updates })
    )
  }

  async archiveIdea(projectId: string, id: string): Promise<IdeasSchema> {
    return this.updateIdea(projectId, id, {
      status: 'archived',
      archivedAt: new Date().toISOString()
    })
  }

  async convertToFeature(projectId: string, id: string): Promise<IdeasSchema> {
    return this.updateIdea(projectId, id, { status: 'converted' })
  }

  async setPriority(
    projectId: string,
    id: string,
    priority: IdeaPriority
  ): Promise<IdeasSchema> {
    return this.updateIdea(projectId, id, { priority })
  }

  async removeIdea(projectId: string, id: string): Promise<IdeasSchema> {
    return this.remove(projectId, (idea) => idea.id === id)
  }
}

export const ideasManager = new IdeasManager()
export default ideasManager
