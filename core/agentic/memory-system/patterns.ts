/**
 * Patterns - Tier 2
 * Persistent learned preferences and decisions.
 */

import fs from 'fs/promises'
import path from 'path'
import pathManager from '../../infrastructure/path-manager'
import type { Patterns, Decision, Workflow } from './types'

export class PatternStore {
  private _patterns: Patterns | null = null
  private _patternsLoaded: boolean = false

  private _getPatternsPath(projectId: string): string {
    return path.join(pathManager.getGlobalProjectPath(projectId), 'memory', 'patterns.json')
  }

  async loadPatterns(projectId: string): Promise<Patterns> {
    if (this._patternsLoaded && this._patterns) {
      return this._patterns
    }

    try {
      const patternsPath = this._getPatternsPath(projectId)
      const content = await fs.readFile(patternsPath, 'utf-8')
      this._patterns = JSON.parse(content)
      this._patternsLoaded = true
      return this._patterns!
    } catch {
      this._patterns = {
        version: 1,
        decisions: {},
        preferences: {},
        workflows: {},
        counters: {},
      }
      this._patternsLoaded = true
      return this._patterns
    }
  }

  async savePatterns(projectId: string): Promise<void> {
    if (!this._patterns) return

    const patternsPath = this._getPatternsPath(projectId)
    await fs.mkdir(path.dirname(patternsPath), { recursive: true })
    await fs.writeFile(patternsPath, JSON.stringify(this._patterns, null, 2), 'utf-8')
  }

  async recordDecision(projectId: string, key: string, value: string, context: string = ''): Promise<void> {
    const patterns = await this.loadPatterns(projectId)

    if (!patterns.decisions[key]) {
      patterns.decisions[key] = {
        value,
        count: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        confidence: 'low',
        contexts: [context].filter(Boolean),
      }
    } else {
      const decision = patterns.decisions[key]

      if (decision.value === value) {
        decision.count++
        decision.lastSeen = new Date().toISOString()
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
        decision.lastSeen = new Date().toISOString()
        decision.confidence = 'low'
      }
    }

    await this.savePatterns(projectId)
  }

  async getDecision(projectId: string, key: string): Promise<{ value: string; confidence: string } | null> {
    const patterns = await this.loadPatterns(projectId)
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
    const patterns = await this.loadPatterns(projectId)

    if (!patterns.workflows[workflowName]) {
      patterns.workflows[workflowName] = {
        ...pattern,
        count: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      }
    } else {
      patterns.workflows[workflowName].count++
      patterns.workflows[workflowName].lastSeen = new Date().toISOString()
    }

    await this.savePatterns(projectId)
  }

  async getWorkflow(projectId: string, workflowName: string): Promise<Workflow | null> {
    const patterns = await this.loadPatterns(projectId)
    const workflow = patterns.workflows[workflowName]

    if (!workflow || workflow.count < 3) return null
    return workflow
  }

  async setPreference(projectId: string, key: string, value: unknown): Promise<void> {
    const patterns = await this.loadPatterns(projectId)
    patterns.preferences[key] = { value, updatedAt: new Date().toISOString() }
    await this.savePatterns(projectId)
  }

  async getPreference(projectId: string, key: string, defaultValue: unknown = null): Promise<unknown> {
    const patterns = await this.loadPatterns(projectId)
    return patterns.preferences[key]?.value ?? defaultValue
  }

  async getPatternsSummary(projectId: string) {
    const patterns = await this.loadPatterns(projectId)

    return {
      decisions: Object.keys(patterns.decisions).length,
      learnedDecisions: Object.values(patterns.decisions).filter((d) => d.confidence !== 'low').length,
      workflows: Object.keys(patterns.workflows).length,
      preferences: Object.keys(patterns.preferences).length,
    }
  }

  reset(): void {
    this._patterns = null
    this._patternsLoaded = false
  }
}
