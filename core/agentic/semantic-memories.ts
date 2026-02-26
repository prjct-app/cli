/**
 * Semantic Memories - Tagged, searchable memory store
 *
 * P3.3: Tagged, searchable, CRUD memory operations.
 * Supports domain-based filtering, relevance scoring,
 * and auto-remember functionality.
 *
 * @module agentic/semantic-memories
 */

import { generateUUID } from '../schemas/schemas'
import type {
  Memory,
  MemoryContext,
  MemoryDatabase,
  MemoryRetrievalResult,
  MemoryTag,
  RelevantMemoryQuery,
  ScoredMemory,
  TaskDomain,
} from '../types/memory'
import { MEMORY_TAGS } from '../types/memory'
import { getTimestamp } from '../utils/date-helper'

import { CachedStore } from './memory-stores'

// =============================================================================
// Semantic Memories
// =============================================================================

/**
 * Semantic Memories
 * P3.3: Tagged, searchable, CRUD memory operations.
 */
export class SemanticMemories extends CachedStore<MemoryDatabase> {
  protected getFilename(): string {
    return 'memories.json'
  }

  protected getDefault(): MemoryDatabase {
    return {
      version: 1,
      memories: [],
      index: this._createEmptyIndex(),
    }
  }

  protected afterLoad(db: MemoryDatabase): void {
    this._normalizeIndex(db)
  }

  private _createEmptyIndex(): Record<string, string[]> {
    const tags = Object.values(MEMORY_TAGS)
    const index: Record<string, string[]> = {}
    for (const tag of tags) index[tag] = []
    return index
  }

  private _normalizeIndex(db: MemoryDatabase): void {
    // Reason: older persisted files may not include newer tags; ensure all tags are present.
    const tags = Object.values(MEMORY_TAGS)
    for (const tag of tags) {
      if (!db.index[tag]) db.index[tag] = []
    }
  }

  private _coerceTags(tags: string[]): MemoryTag[] {
    const allowed = new Set<MemoryTag>(Object.values(MEMORY_TAGS) as MemoryTag[])
    return tags.filter((t): t is MemoryTag => allowed.has(t as MemoryTag))
  }

  async loadMemories(projectId: string): Promise<MemoryDatabase> {
    return this.load(projectId)
  }

  async saveMemories(projectId: string): Promise<void> {
    return this.save(projectId)
  }

  async createMemory(
    projectId: string,
    {
      title,
      content,
      tags = [],
      userTriggered = false,
    }: { title: string; content: string; tags?: string[]; userTriggered?: boolean }
  ): Promise<string> {
    const db = await this.load(projectId)
    const parsedTags = this._coerceTags(tags)
    const now = getTimestamp()

    const memory: Memory = {
      id: generateUUID(),
      title,
      content,
      tags: parsedTags,
      userTriggered,
      createdAt: now,
      updatedAt: now,
    }

    db.memories.push(memory)

    for (const tag of parsedTags) {
      db.index[tag].push(memory.id)
    }

    await this.save(projectId)
    return memory.id
  }

  async updateMemory(
    projectId: string,
    memoryId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ): Promise<boolean> {
    const db = await this.load(projectId)

    const index = db.memories.findIndex((m) => m.id === memoryId)
    if (index === -1) return false

    const memory = db.memories[index]
    const oldTags = memory.tags || []

    if (updates.title) memory.title = updates.title
    if (updates.content) memory.content = updates.content
    if (updates.tags) {
      const newTags = this._coerceTags(updates.tags)
      for (const tag of oldTags) {
        db.index[tag] = db.index[tag].filter((id: string) => id !== memoryId)
      }
      for (const tag of newTags) {
        db.index[tag].push(memoryId)
      }
      memory.tags = newTags
    }

    memory.updatedAt = getTimestamp()
    await this.save(projectId)
    return true
  }

  async deleteMemory(projectId: string, memoryId: string): Promise<boolean> {
    const db = await this.load(projectId)

    const index = db.memories.findIndex((m) => m.id === memoryId)
    if (index === -1) return false

    const memory = db.memories[index]

    for (const tag of memory.tags || []) {
      if (db.index[tag]) {
        db.index[tag] = db.index[tag].filter((id) => id !== memoryId)
      }
    }

    db.memories.splice(index, 1)
    await this.save(projectId)
    return true
  }

  async findByTags(
    projectId: string,
    tags: string[],
    matchAll: boolean = false
  ): Promise<Memory[]> {
    const db = await this.load(projectId)
    const parsedTags = this._coerceTags(tags)

    if (matchAll) {
      return db.memories.filter((m) => parsedTags.every((tag) => (m.tags || []).includes(tag)))
    } else {
      const matchingIds = new Set<string>()
      for (const tag of parsedTags) {
        const ids = db.index[tag]
        for (const id of ids) {
          matchingIds.add(id)
        }
      }
      return db.memories.filter((m) => matchingIds.has(m.id))
    }
  }

  async searchMemories(projectId: string, query: string): Promise<Memory[]> {
    const db = await this.load(projectId)
    const queryLower = query.toLowerCase()

    return db.memories.filter(
      (m) =>
        m.title.toLowerCase().includes(queryLower) || m.content.toLowerCase().includes(queryLower)
    )
  }

  async getRelevantMemories(
    projectId: string,
    context: MemoryContext,
    limit: number = 5
  ): Promise<Memory[]> {
    const db = await this.load(projectId)

    const scored = db.memories.map((memory) => {
      let score = 0

      const contextTags = this._extractContextTags(context)
      for (const tag of memory.tags || []) {
        if (contextTags.includes(tag)) score += 10
      }

      const age = Date.now() - new Date(memory.updatedAt).getTime()
      const daysSinceUpdate = age / (1000 * 60 * 60 * 24)
      score += Math.max(0, 5 - daysSinceUpdate)

      if (memory.userTriggered) score += 5

      const keywords = this._extractKeywords(context)
      for (const keyword of keywords) {
        if (memory.content.toLowerCase().includes(keyword)) score += 2
        if (memory.title.toLowerCase().includes(keyword)) score += 3
      }

      return { ...memory, _score: score }
    })

    return scored
      .filter((m) => m._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...memory }) => memory as Memory)
  }

  /**
   * Enhanced memory retrieval with domain-based filtering and metrics.
   * Implements selective memory retrieval based on task relevance.
   * @see PRJ-107
   */
  async getRelevantMemoriesWithMetrics(
    projectId: string,
    query: RelevantMemoryQuery
  ): Promise<MemoryRetrievalResult> {
    const db = await this.load(projectId)
    const totalMemories = db.memories.length

    if (totalMemories === 0) {
      return {
        memories: [],
        metrics: {
          totalMemories: 0,
          memoriesConsidered: 0,
          memoriesReturned: 0,
          filteringRatio: 0,
          avgRelevanceScore: 0,
        },
      }
    }

    const maxResults = query.maxResults ?? 10
    const minRelevance = query.minRelevance ?? 10

    // Score all memories
    const scored: ScoredMemory[] = db.memories.map((memory) => {
      const breakdown = {
        domainMatch: 0,
        tagMatch: 0,
        recency: 0,
        confidence: 0,
        keywords: 0,
        userTriggered: 0,
      }

      // Domain match scoring (0-25 points) — semantic matching (PRJ-300)
      if (query.taskDomain) {
        breakdown.domainMatch = this._getSemanticDomainScore(query.taskDomain, memory.tags || [])
      }

      // Tag match from command context (0-20 points)
      if (query.commandName) {
        const commandTags = this._getCommandTags(query.commandName)
        const matchingTags = (memory.tags || []).filter((tag) => commandTags.includes(tag))
        breakdown.tagMatch = Math.min(20, matchingTags.length * 8)
      }

      // Recency scoring (0-15 points)
      const age = Date.now() - new Date(memory.updatedAt).getTime()
      const daysSinceUpdate = age / (1000 * 60 * 60 * 24)
      breakdown.recency = Math.max(0, Math.round(15 - daysSinceUpdate * 0.5))

      // Confidence scoring (0-20 points) - PRJ-104 integration
      if (memory.confidence) {
        breakdown.confidence =
          memory.confidence === 'high' ? 20 : memory.confidence === 'medium' ? 12 : 5
      } else if (memory.observationCount) {
        // Fallback to observation count
        breakdown.confidence = Math.min(20, memory.observationCount * 3)
      }

      // Keyword matching (0-15 points)
      if (query.taskDescription) {
        const keywords = this._extractKeywordsFromText(query.taskDescription)
        let keywordScore = 0
        for (const keyword of keywords) {
          if (memory.content.toLowerCase().includes(keyword)) keywordScore += 2
          if (memory.title.toLowerCase().includes(keyword)) keywordScore += 3
        }
        breakdown.keywords = Math.min(15, keywordScore)
      }

      // User triggered bonus (0-5 points)
      if (memory.userTriggered) {
        breakdown.userTriggered = 5
      }

      const relevanceScore =
        breakdown.domainMatch +
        breakdown.tagMatch +
        breakdown.recency +
        breakdown.confidence +
        breakdown.keywords +
        breakdown.userTriggered

      return {
        ...memory,
        relevanceScore,
        scoreBreakdown: breakdown,
      }
    })

    // Filter by minimum relevance
    const considered = scored.filter((m) => m.relevanceScore >= minRelevance)

    // Sort by relevance and take top N
    const sorted = considered.sort((a, b) => b.relevanceScore - a.relevanceScore)
    const returned = sorted.slice(0, maxResults)

    // Calculate average relevance
    const avgRelevanceScore =
      returned.length > 0
        ? Math.round(returned.reduce((sum, m) => sum + m.relevanceScore, 0) / returned.length)
        : 0

    return {
      memories: returned,
      metrics: {
        totalMemories,
        memoriesConsidered: considered.length,
        memoriesReturned: returned.length,
        filteringRatio: totalMemories > 0 ? returned.length / totalMemories : 0,
        avgRelevanceScore,
      },
    }
  }

  /**
   * Semantic domain match score.
   * Domain-based scoring removed (LLM-over-heuristic). Returns 0.
   * Memories are filtered by other criteria (text match, tag match, recency).
   */
  private _getSemanticDomainScore(_domain: TaskDomain, _memoryTags: string[]): number {
    return 0
  }

  /**
   * Map command to relevant memory tags.
   * @see PRJ-107
   */
  private _getCommandTags(commandName: string): MemoryTag[] {
    const commandTags: Record<string, MemoryTag[]> = {
      ship: [MEMORY_TAGS.COMMIT_STYLE, MEMORY_TAGS.SHIP_WORKFLOW, MEMORY_TAGS.TEST_BEHAVIOR],
      feature: [MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.CODE_STYLE],
      done: [MEMORY_TAGS.SHIP_WORKFLOW],
      analyze: [MEMORY_TAGS.TECH_STACK, MEMORY_TAGS.ARCHITECTURE],
      spec: [MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.CODE_STYLE],
      task: [MEMORY_TAGS.BRANCH_NAMING, MEMORY_TAGS.CODE_STYLE],
      sync: [MEMORY_TAGS.TECH_STACK, MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.DEPENDENCIES],
      test: [MEMORY_TAGS.TEST_BEHAVIOR],
      bug: [MEMORY_TAGS.CODE_STYLE, MEMORY_TAGS.TEST_BEHAVIOR],
    }
    return commandTags[commandName] || []
  }

  /**
   * Extract keywords from text for matching.
   */
  private _extractKeywordsFromText(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/)
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'to',
      'for',
      'and',
      'or',
      'in',
      'on',
      'at',
      'by',
      'with',
      'from',
      'as',
      'it',
      'this',
      'that',
      'be',
      'have',
      'has',
    ])
    return words.filter((w) => w.length > 2 && !stopWords.has(w))
  }

  private _extractContextTags(context: MemoryContext): string[] {
    const tags: string[] = []

    const commandTags: Record<string, string[]> = {
      ship: [MEMORY_TAGS.COMMIT_STYLE, MEMORY_TAGS.SHIP_WORKFLOW, MEMORY_TAGS.TEST_BEHAVIOR],
      feature: [MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.CODE_STYLE],
      done: [MEMORY_TAGS.SHIP_WORKFLOW],
      analyze: [MEMORY_TAGS.TECH_STACK, MEMORY_TAGS.ARCHITECTURE],
      spec: [MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.CODE_STYLE],
    }

    if (context.commandName && commandTags[context.commandName]) {
      tags.push(...commandTags[context.commandName])
    }

    return tags
  }

  private _extractKeywords(context: MemoryContext): string[] {
    const keywords: string[] = []

    if (context.params?.description) {
      keywords.push(...(context.params.description as string).toLowerCase().split(/\s+/))
    }
    if (context.params?.feature) {
      keywords.push(...(context.params.feature as string).toLowerCase().split(/\s+/))
    }

    const stopWords = ['the', 'a', 'an', 'is', 'are', 'to', 'for', 'and', 'or', 'in']
    return keywords.filter((k) => k.length > 2 && !stopWords.includes(k))
  }

  async autoRemember(
    projectId: string,
    decisionType: string,
    value: string,
    context: string = ''
  ): Promise<void> {
    const tagMap: Record<string, string[]> = {
      commit_footer: [MEMORY_TAGS.COMMIT_STYLE],
      branch_naming: [MEMORY_TAGS.BRANCH_NAMING],
      test_before_ship: [MEMORY_TAGS.TEST_BEHAVIOR, MEMORY_TAGS.SHIP_WORKFLOW],
      preferred_agent: [MEMORY_TAGS.AGENT_PREFERENCE],
      code_style: [MEMORY_TAGS.CODE_STYLE],
      verbosity: [MEMORY_TAGS.OUTPUT_VERBOSITY],
    }

    const tags = tagMap[decisionType] || []

    const existing = await this.searchMemories(projectId, decisionType)
    if (existing.length > 0) {
      await this.updateMemory(projectId, existing[0].id, {
        content: `${decisionType}: ${value}`,
        tags,
      })
    } else {
      await this.createMemory(projectId, {
        title: `Preference: ${decisionType}`,
        content: `${decisionType}: ${value}${context ? `\nContext: ${context}` : ''}`,
        tags,
        userTriggered: true,
      })
    }
  }

  async getAllMemories(projectId: string): Promise<Memory[]> {
    const db = await this.load(projectId)
    return db.memories
  }

  async getMemoryStats(projectId: string) {
    const db = await this.load(projectId)

    const tagCounts: Record<string, number> = {}
    for (const [tag, ids] of Object.entries(db.index)) {
      tagCounts[tag] = ids.length
    }

    return {
      totalMemories: db.memories.length,
      userTriggered: db.memories.filter((m) => m.userTriggered).length,
      tagCounts,
      oldestMemory: db.memories[0]?.createdAt,
      newestMemory: db.memories[db.memories.length - 1]?.createdAt,
    }
  }
}
