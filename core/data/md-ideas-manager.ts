/**
 * MD Ideas Manager
 *
 * MD-First Architecture: Manages ideas via ideas.md.
 * Source of truth is the markdown file, not JSON.
 */

import { MdArrayManager } from './md-base-manager'
import { parseIdeas, serializeIdeas, type Idea, type IdeaStatus, type IdeaPriority } from '../serializers/ideas-serializer'
import { generateUUID } from '../schemas'

class MdIdeasManager extends MdArrayManager<Idea> {
  constructor() {
    super('planning/ideas.md')
  }

  protected parse(content: string): Idea[] {
    return parseIdeas(content)
  }

  protected serialize(data: Idea[]): string {
    return serializeIdeas(data)
  }

  // =========== Ideas Operations ===========

  /**
   * Add a new idea
   */
  async addIdea(
    projectId: string,
    text: string,
    options?: { tags?: string[]; priority?: IdeaPriority }
  ): Promise<Idea[]> {
    const idea: Idea = {
      id: generateUUID(),
      text,
      status: 'pending',
      priority: options?.priority || 'medium',
      tags: options?.tags || [],
      addedAt: new Date().toISOString()
    }

    return this.add(projectId, idea)
  }

  /**
   * Get all ideas
   */
  async getAll(projectId: string): Promise<Idea[]> {
    return this.read(projectId)
  }

  /**
   * Get pending ideas
   */
  async getPending(projectId: string): Promise<Idea[]> {
    const all = await this.read(projectId)
    return all.filter(i => i.status === 'pending')
  }

  /**
   * Get idea by ID
   */
  async getById(projectId: string, id: string): Promise<Idea | undefined> {
    return this.find(projectId, i => i.id === id)
  }

  /**
   * Convert idea to feature
   */
  async convertToFeature(projectId: string, id: string, featureId: string): Promise<Idea[]> {
    return this.updateItem(
      projectId,
      i => i.id === id,
      i => ({ ...i, status: 'converted' as IdeaStatus, convertedTo: featureId })
    )
  }

  /**
   * Archive an idea
   */
  async archive(projectId: string, id: string): Promise<Idea[]> {
    return this.updateItem(
      projectId,
      i => i.id === id,
      i => ({ ...i, status: 'archived' as IdeaStatus })
    )
  }

  /**
   * Update idea priority
   */
  async setPriority(projectId: string, id: string, priority: IdeaPriority): Promise<Idea[]> {
    return this.updateItem(
      projectId,
      i => i.id === id,
      i => ({ ...i, priority })
    )
  }

  /**
   * Add tags to an idea
   */
  async addTags(projectId: string, id: string, tags: string[]): Promise<Idea[]> {
    return this.updateItem(
      projectId,
      i => i.id === id,
      i => ({ ...i, tags: [...new Set([...i.tags, ...tags])] })
    )
  }

  /**
   * Remove an idea
   */
  async removeIdea(projectId: string, id: string): Promise<Idea[]> {
    return this.remove(projectId, i => i.id === id)
  }

  /**
   * Get ideas count by status
   */
  async getCounts(projectId: string): Promise<{ pending: number; converted: number; archived: number }> {
    const all = await this.read(projectId)
    return {
      pending: all.filter(i => i.status === 'pending').length,
      converted: all.filter(i => i.status === 'converted').length,
      archived: all.filter(i => i.status === 'archived').length
    }
  }

  /**
   * Clean up empty sections (remove archived ideas older than 30 days)
   */
  async cleanup(projectId: string): Promise<{ removed: number }> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const all = await this.read(projectId)
    const toKeep = all.filter(i => {
      if (i.status !== 'archived') return true
      return new Date(i.addedAt) > thirtyDaysAgo
    })

    const removed = all.length - toKeep.length
    if (removed > 0) {
      await this.write(projectId, toKeep)
    }

    return { removed }
  }
}

export const mdIdeasManager = new MdIdeasManager()
export default mdIdeasManager
