/**
 * Patterns - Tier 2
 * Persistent learned preferences and decisions.
 */

import { CachedStore } from './base-store'
import { getTimestamp } from '../../utils/date-helper'
import type { Patterns, Decision, Workflow, Preference } from './types'

export class PatternStore extends CachedStore<Patterns> {
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

  // Convenience alias for backward compatibility
  async loadPatterns(projectId: string): Promise<Patterns> {
    return this.load(projectId)
  }

  async savePatterns(projectId: string): Promise<void> {
    return this.save(projectId)
  }

  async recordDecision(projectId: string, key: string, value: string, context: string = ''): Promise<void> {
    const patterns = await this.load(projectId)
    const now = getTimestamp()

    if (!patterns.decisions[key]) {
      patterns.decisions[key] = {
        value,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        confidence: 'low',
        contexts: [context].filter(Boolean),
      }
    } else {
      const decision = patterns.decisions[key]

      if (decision.value === value) {
        decision.count++
        decision.lastSeen = now
        if (context && !decision.contexts.includes(context)) {
          decision.contexts.push(context)
        }

        if (decision.count >= 5) {
          decision.confidence = 'high'
        } else if (decision.count >= 3) {
          decision.confidence = 'medium'
        }
      } else {
        decision.value = value
        decision.count = 1
        decision.lastSeen = now
        decision.confidence = 'low'
      }
    }

    await this.save(projectId)
  }

  async getDecision(projectId: string, key: string): Promise<{ value: string; confidence: string } | null> {
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

  async recordWorkflow(projectId: string, workflowName: string, pattern: Record<string, unknown>): Promise<void> {
    const patterns = await this.load(projectId)
    const now = getTimestamp()

    if (!patterns.workflows[workflowName]) {
      patterns.workflows[workflowName] = {
        ...pattern,
        count: 1,
        firstSeen: now,
        lastSeen: now,
      }
    } else {
      patterns.workflows[workflowName].count++
      patterns.workflows[workflowName].lastSeen = now
    }

    await this.save(projectId)
  }

  async getWorkflow(projectId: string, workflowName: string): Promise<Workflow | null> {
    const patterns = await this.load(projectId)
    const workflow = patterns.workflows[workflowName]

    if (!workflow || workflow.count < 3) return null
    return workflow
  }

  async setPreference(projectId: string, key: string, value: Preference['value']): Promise<void> {
    const patterns = await this.load(projectId)
    patterns.preferences[key] = { value, updatedAt: getTimestamp() }
    await this.save(projectId)
  }

  async getPreference(projectId: string, key: string, defaultValue: unknown = null): Promise<unknown> {
    const patterns = await this.load(projectId)
    return patterns.preferences[key]?.value ?? defaultValue
  }

  async getPatternsSummary(projectId: string) {
    const patterns = await this.load(projectId)

    return {
      decisions: Object.keys(patterns.decisions).length,
      learnedDecisions: Object.values(patterns.decisions).filter((d) => d.confidence !== 'low').length,
      workflows: Object.keys(patterns.workflows).length,
      preferences: Object.keys(patterns.preferences).length,
    }
  }
}
