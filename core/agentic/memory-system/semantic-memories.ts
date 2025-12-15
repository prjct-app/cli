/**
 * Semantic Memories
 * P3.3: Tagged, searchable, CRUD memory operations.
 */

import fs from 'fs/promises'
import path from 'path'
import pathManager from '../../infrastructure/path-manager'
import { generateUUID } from '../../schemas'
import type { Memory, MemoryDatabase, Context } from './types'
import { MEMORY_TAGS } from './types'

export class SemanticMemories {
  private _memories: MemoryDatabase | null = null
  private _memoriesLoaded: boolean = false

  private _getMemoriesPath(projectId: string): string {
    return path.join(pathManager.getGlobalProjectPath(projectId), 'memory', 'memories.json')
  }

  async loadMemories(projectId: string): Promise<MemoryDatabase> {
    if (this._memoriesLoaded && this._memories) {
      return this._memories
    }

    try {
      const memoriesPath = this._getMemoriesPath(projectId)
      const content = await fs.readFile(memoriesPath, 'utf-8')
      this._memories = JSON.parse(content)
      this._memoriesLoaded = true
      return this._memories!
    } catch {
      this._memories = {
        version: 1,
        memories: [],
        index: {},
      }
      this._memoriesLoaded = true
      return this._memories
    }
  }

  async saveMemories(projectId: string): Promise<void> {
    if (!this._memories) return

    const memoriesPath = this._getMemoriesPath(projectId)
    await fs.mkdir(path.dirname(memoriesPath), { recursive: true })
    await fs.writeFile(memoriesPath, JSON.stringify(this._memories, null, 2), 'utf-8')
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
    const db = await this.loadMemories(projectId)

    const memory: Memory = {
      id: generateUUID(),
      title,
      content,
      tags,
      userTriggered,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    db.memories.push(memory)

    for (const tag of tags) {
      if (!db.index[tag]) db.index[tag] = []
      db.index[tag].push(memory.id)
    }

    await this.saveMemories(projectId)
    return memory.id
  }

  async updateMemory(
    projectId: string,
    memoryId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ): Promise<boolean> {
    const db = await this.loadMemories(projectId)

    const index = db.memories.findIndex((m) => m.id === memoryId)
    if (index === -1) return false

    const memory = db.memories[index]
    const oldTags = memory.tags || []

    if (updates.title) memory.title = updates.title
    if (updates.content) memory.content = updates.content
    if (updates.tags) {
      for (const tag of oldTags) {
        if (db.index[tag]) {
          db.index[tag] = db.index[tag].filter((id) => id !== memoryId)
        }
      }
      for (const tag of updates.tags) {
        if (!db.index[tag]) db.index[tag] = []
        db.index[tag].push(memoryId)
      }
      memory.tags = updates.tags
    }

    memory.updatedAt = new Date().toISOString()
    await this.saveMemories(projectId)
    return true
  }

  async deleteMemory(projectId: string, memoryId: string): Promise<boolean> {
    const db = await this.loadMemories(projectId)

    const index = db.memories.findIndex((m) => m.id === memoryId)
    if (index === -1) return false

    const memory = db.memories[index]

    for (const tag of memory.tags || []) {
      if (db.index[tag]) {
        db.index[tag] = db.index[tag].filter((id) => id !== memoryId)
      }
    }

    db.memories.splice(index, 1)
    await this.saveMemories(projectId)
    return true
  }

  async findByTags(projectId: string, tags: string[], matchAll: boolean = false): Promise<Memory[]> {
    const db = await this.loadMemories(projectId)

    if (matchAll) {
      return db.memories.filter((m) => tags.every((tag) => (m.tags || []).includes(tag)))
    } else {
      const matchingIds = new Set<string>()
      for (const tag of tags) {
        const ids = db.index[tag] || []
        ids.forEach((id) => matchingIds.add(id))
      }
      return db.memories.filter((m) => matchingIds.has(m.id))
    }
  }

  async searchMemories(projectId: string, query: string): Promise<Memory[]> {
    const db = await this.loadMemories(projectId)
    const queryLower = query.toLowerCase()

    return db.memories.filter(
      (m) => m.title.toLowerCase().includes(queryLower) || m.content.toLowerCase().includes(queryLower)
    )
  }

  async getRelevantMemories(projectId: string, context: Context, limit: number = 5): Promise<Memory[]> {
    const db = await this.loadMemories(projectId)

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

  private _extractContextTags(context: Context): string[] {
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

  private _extractKeywords(context: Context): string[] {
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

  async autoRemember(projectId: string, decisionType: string, value: string, context: string = ''): Promise<void> {
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
    const db = await this.loadMemories(projectId)
    return db.memories
  }

  async getMemoryStats(projectId: string) {
    const db = await this.loadMemories(projectId)

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

  reset(): void {
    this._memories = null
    this._memoriesLoaded = false
  }
}
