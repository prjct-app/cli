/**
 * Ideas Storage
 *
 * Manages ideas via storage/ideas.json
 * Generates context/ideas.md for Claude
 */

import { generateUUID } from '../schemas'
import { IdeasJsonSchema } from '../schemas/ideas'
import type { Idea, IdeaPriority, IdeaStatus, IdeasJson } from '../types'
import { getDaysAgo, getTimestamp } from '../utils/date-helper'
import { ARCHIVE_POLICIES, archiveStorage } from './archive-storage'
import { StorageManager } from './storage-manager'

class IdeasStorage extends StorageManager<IdeasJson> {
  constructor() {
    super('ideas.json', IdeasJsonSchema)
  }

  protected getDefault(): IdeasJson {
    return {
      ideas: [],
      lastUpdated: '',
    }
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `ideas.${action}d`
  }

  // =========== Domain Methods ===========

  /**
   * Get all ideas
   */
  async getAll(projectId: string): Promise<Idea[]> {
    const data = await this.read(projectId)
    return data.ideas
  }

  /**
   * Get pending ideas
   */
  async getPending(projectId: string): Promise<Idea[]> {
    const data = await this.read(projectId)
    return data.ideas.filter((i) => i.status === 'pending')
  }

  /**
   * Add a new idea
   */
  async addIdea(
    projectId: string,
    text: string,
    options: { tags?: string[]; priority?: IdeaPriority } = {}
  ): Promise<Idea> {
    const idea: Idea = {
      id: generateUUID(),
      text,
      status: 'pending',
      priority: options.priority || 'medium',
      tags: options.tags || [],
      addedAt: getTimestamp(),
    }

    await this.update(projectId, (data) => ({
      ideas: [idea, ...data.ideas], // Prepend new ideas
      lastUpdated: getTimestamp(),
    }))

    // Publish event
    await this.publishEvent(projectId, 'idea.created', {
      ideaId: idea.id,
      text: idea.text,
      priority: idea.priority,
    })

    return idea
  }

  /**
   * Get idea by ID
   */
  async getById(projectId: string, id: string): Promise<Idea | undefined> {
    const data = await this.read(projectId)
    return data.ideas.find((i) => i.id === id)
  }

  /**
   * Convert idea to feature
   */
  async convertToFeature(projectId: string, ideaId: string, featureId: string): Promise<void> {
    await this.update(projectId, (data) => ({
      ideas: data.ideas.map((i) =>
        i.id === ideaId ? { ...i, status: 'converted' as IdeaStatus, convertedTo: featureId } : i
      ),
      lastUpdated: getTimestamp(),
    }))

    await this.publishEvent(projectId, 'idea.converted', {
      ideaId,
      featureId,
    })
  }

  /**
   * Archive an idea
   */
  async archive(projectId: string, ideaId: string): Promise<void> {
    await this.update(projectId, (data) => ({
      ideas: data.ideas.map((i) =>
        i.id === ideaId ? { ...i, status: 'archived' as IdeaStatus } : i
      ),
      lastUpdated: getTimestamp(),
    }))

    await this.publishEvent(projectId, 'idea.archived', { ideaId })
  }

  /**
   * Set priority
   */
  async setPriority(projectId: string, ideaId: string, priority: IdeaPriority): Promise<void> {
    await this.update(projectId, (data) => ({
      ideas: data.ideas.map((i) => (i.id === ideaId ? { ...i, priority } : i)),
      lastUpdated: getTimestamp(),
    }))
  }

  /**
   * Add tags to an idea
   */
  async addTags(projectId: string, ideaId: string, tags: string[]): Promise<void> {
    await this.update(projectId, (data) => ({
      ideas: data.ideas.map((i) =>
        i.id === ideaId ? { ...i, tags: [...new Set([...i.tags, ...tags])] } : i
      ),
      lastUpdated: getTimestamp(),
    }))
  }

  /**
   * Remove an idea
   */
  async removeIdea(projectId: string, ideaId: string): Promise<void> {
    await this.update(projectId, (data) => ({
      ideas: data.ideas.filter((i) => i.id !== ideaId),
      lastUpdated: getTimestamp(),
    }))
  }

  /**
   * Get counts by status
   */
  async getCounts(
    projectId: string
  ): Promise<{ pending: number; converted: number; archived: number }> {
    const data = await this.read(projectId)
    return {
      pending: data.ideas.filter((i) => i.status === 'pending').length,
      converted: data.ideas.filter((i) => i.status === 'converted').length,
      archived: data.ideas.filter((i) => i.status === 'archived').length,
    }
  }

  /**
   * Cleanup old archived ideas (keep last 50)
   */
  async cleanup(projectId: string): Promise<{ removed: number }> {
    const data = await this.read(projectId)
    const archived = data.ideas.filter((i) => i.status === 'archived')

    if (archived.length <= 50) {
      return { removed: 0 }
    }

    // Sort by date and keep newest 50
    const sortedArchived = archived.sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    )
    const toRemove = new Set(sortedArchived.slice(50).map((i) => i.id))
    const removed = toRemove.size

    await this.update(projectId, (d) => ({
      ideas: d.ideas.filter((i) => !toRemove.has(i.id)),
      lastUpdated: getTimestamp(),
    }))

    return { removed }
  }

  /**
   * Mark pending ideas older than retention period as dormant (PRJ-267).
   * Dormant ideas are excluded from LLM context but remain queryable.
   * Returns count of newly dormant ideas.
   */
  async markDormantIdeas(projectId: string): Promise<number> {
    const data = await this.read(projectId)
    const threshold = getDaysAgo(ARCHIVE_POLICIES.IDEA_DORMANT_DAYS)

    const stalePending = data.ideas.filter(
      (i) => i.status === 'pending' && new Date(i.addedAt) < threshold
    )

    if (stalePending.length === 0) return 0

    // Archive to SQLite for long-term access
    archiveStorage.archiveMany(
      projectId,
      stalePending.map((idea) => ({
        entityType: 'idea' as const,
        entityId: idea.id,
        entityData: idea,
        summary: idea.text,
        reason: 'dormant',
      }))
    )

    // Mark as dormant in active storage (excluded from context)
    const staleIds = new Set(stalePending.map((i) => i.id))

    await this.update(projectId, (d) => ({
      ideas: d.ideas.map((i) =>
        staleIds.has(i.id) ? { ...i, status: 'dormant' as IdeaStatus } : i
      ),
      lastUpdated: getTimestamp(),
    }))

    await this.publishEvent(projectId, 'ideas.dormant', {
      count: stalePending.length,
    })

    return stalePending.length
  }
}

export const ideasStorage = new IdeasStorage()
export default ideasStorage
