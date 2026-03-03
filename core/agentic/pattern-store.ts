/**
 * Pattern Store - Tier 2 Memory
 *
 * Persistent learned preferences and decisions.
 * Records user decisions, workflow patterns, and preferences
 * with confidence tracking and archival support.
 *
 * @module agentic/pattern-store
 */

import prjctDb from '../storage/database'
import type { Patterns, Preference, Workflow } from '../types/memory'
import { calculateConfidence } from '../types/memory'
import { getTimestamp } from '../utils/date-helper'

import { CachedStore } from './memory-stores'

// =============================================================================
// Pattern Store (Tier 2)
// =============================================================================

/**
 * Patterns - Tier 2
 * Persistent learned preferences and decisions.
 */
export class PatternStore extends CachedStore<Patterns> {
  private static readonly MAX_CONTEXTS = 20
  private static readonly ARCHIVE_AGE_DAYS = 90

  protected getFilename(): string {
    return 'patterns.json'
  }

  protected getDefault(): Patterns {
    return {
      version: 1,
      decisions: {},
      preferences: {},
      workflows: {},
      counters: {},
    }
  }

  protected afterLoad(patterns: Patterns): void {
    for (const decision of Object.values(patterns.decisions)) {
      if (!Array.isArray(decision.contexts)) decision.contexts = []
      if (decision.contexts.length > PatternStore.MAX_CONTEXTS) {
        decision.contexts = decision.contexts.slice(-PatternStore.MAX_CONTEXTS)
      }
    }
  }

  async loadPatterns(projectId: string): Promise<Patterns> {
    return this.load(projectId)
  }

  async savePatterns(projectId: string): Promise<void> {
    return this.save(projectId)
  }

  async recordDecision(
    projectId: string,
    key: string,
    value: string,
    context: string = '',
    options: { userConfirmed?: boolean } = {}
  ): Promise<void> {
    const patterns = await this.load(projectId)
    const now = getTimestamp()

    if (!patterns.decisions[key]) {
      patterns.decisions[key] = {
        value,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        confidence: options.userConfirmed ? 'high' : 'low',
        contexts: [context].filter(Boolean),
        userConfirmed: options.userConfirmed || false,
      } as Patterns['decisions'][string]
    } else {
      const decision = patterns.decisions[key] as Patterns['decisions'][string] & {
        userConfirmed?: boolean
      }

      if (decision.value === value) {
        decision.count++
        decision.lastSeen = now
        if (context && !decision.contexts.includes(context)) {
          decision.contexts.push(context)
          if (decision.contexts.length > PatternStore.MAX_CONTEXTS) {
            decision.contexts = decision.contexts.slice(-PatternStore.MAX_CONTEXTS)
          }
        }
        if (options.userConfirmed) {
          decision.userConfirmed = true
        }
        decision.confidence = calculateConfidence(decision.count, decision.userConfirmed)
      } else {
        decision.value = value
        decision.count = 1
        decision.lastSeen = now
        decision.userConfirmed = options.userConfirmed || false
        decision.confidence = options.userConfirmed ? 'high' : 'low'
      }
    }

    await this.save(projectId)
  }

  async confirmDecision(projectId: string, key: string): Promise<boolean> {
    const patterns = await this.load(projectId)
    const decision = patterns.decisions[key] as
      | (Patterns['decisions'][string] & { userConfirmed?: boolean })
      | undefined
    if (!decision) return false

    decision.userConfirmed = true
    decision.confidence = 'high'
    decision.lastSeen = getTimestamp()
    await this.save(projectId)
    return true
  }

  async getDecision(
    projectId: string,
    key: string
  ): Promise<{ value: string; confidence: string } | null> {
    const patterns = await this.load(projectId)
    const decision = patterns.decisions[key]

    if (!decision) return null
    if (decision.confidence === 'low') return null

    return { value: decision.value, confidence: decision.confidence }
  }

  async hasPattern(projectId: string, key: string): Promise<boolean> {
    const decision = await this.getDecision(projectId, key)
    return decision !== null
  }

  async recordWorkflow(
    projectId: string,
    workflowName: string,
    pattern: Record<string, unknown>
  ): Promise<void> {
    const patterns = await this.load(projectId)
    const now = getTimestamp()

    if (!patterns.workflows[workflowName]) {
      patterns.workflows[workflowName] = {
        ...pattern,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        confidence: 'low',
        userConfirmed: false,
      }
    } else {
      const workflow = patterns.workflows[workflowName]
      workflow.count++
      workflow.lastSeen = now
      workflow.confidence = calculateConfidence(workflow.count, workflow.userConfirmed)
    }

    await this.save(projectId)
  }

  async confirmWorkflow(projectId: string, workflowName: string): Promise<boolean> {
    const patterns = await this.load(projectId)
    const workflow = patterns.workflows[workflowName]
    if (!workflow) return false

    workflow.userConfirmed = true
    workflow.confidence = 'high'
    workflow.lastSeen = getTimestamp()
    await this.save(projectId)
    return true
  }

  async getWorkflow(projectId: string, workflowName: string): Promise<Workflow | null> {
    const patterns = await this.load(projectId)
    const workflow = patterns.workflows[workflowName]

    if (!workflow || workflow.count < 3) return null
    return workflow
  }

  async setPreference(
    projectId: string,
    key: string,
    value: Preference['value'],
    options: { userConfirmed?: boolean } = {}
  ): Promise<void> {
    const patterns = await this.load(projectId)
    const existing = patterns.preferences[key]
    const observationCount = existing ? existing.observationCount + 1 : 1
    const userConfirmed = options.userConfirmed || existing?.userConfirmed || false

    patterns.preferences[key] = {
      value,
      updatedAt: getTimestamp(),
      confidence: calculateConfidence(observationCount, userConfirmed),
      observationCount,
      userConfirmed,
    }
    await this.save(projectId)
  }

  async confirmPreference(projectId: string, key: string): Promise<boolean> {
    const patterns = await this.load(projectId)
    const pref = patterns.preferences[key]
    if (!pref) return false

    pref.userConfirmed = true
    pref.confidence = 'high'
    pref.updatedAt = getTimestamp()
    await this.save(projectId)
    return true
  }

  async getPreference(
    projectId: string,
    key: string,
    defaultValue: unknown = null
  ): Promise<unknown> {
    const patterns = await this.load(projectId)
    return patterns.preferences[key]?.value ?? defaultValue
  }

  async getPatternsSummary(projectId: string) {
    const patterns = await this.load(projectId)

    return {
      decisions: Object.keys(patterns.decisions).length,
      learnedDecisions: Object.values(patterns.decisions).filter((d) => d.confidence !== 'low')
        .length,
      workflows: Object.keys(patterns.workflows).length,
      preferences: Object.keys(patterns.preferences).length,
    }
  }

  async archiveStaleDecisions(projectId: string): Promise<number> {
    const patterns = await this.load(projectId)
    const now = Date.now()
    const cutoff = PatternStore.ARCHIVE_AGE_DAYS * 24 * 60 * 60 * 1000

    const staleKeys: string[] = []
    for (const [key, decision] of Object.entries(patterns.decisions)) {
      const lastSeenMs = new Date(decision.lastSeen).getTime()
      if (now - lastSeenMs > cutoff) {
        staleKeys.push(key)
      }
    }

    if (staleKeys.length === 0) return 0

    // Load or create archive from SQLite
    const archive: Record<string, unknown> =
      prjctDb.getDoc<Record<string, unknown>>(projectId, 'memory:patterns-archive') ?? {}

    // Move stale decisions to archive
    for (const key of staleKeys) {
      archive[key] = patterns.decisions[key]
      delete patterns.decisions[key]
    }

    // Save archive and pruned patterns
    prjctDb.setDoc(projectId, 'memory:patterns-archive', archive)
    await this.save(projectId)

    return staleKeys.length
  }
}
