/**
 * Memory System
 * Tracks user preferences, decisions, and learned patterns.
 *
 * Three-tier memory system:
 * - Tier 1: Session (ephemeral) - single command context
 * - Tier 2: Patterns (persistent) - learned preferences and decisions
 * - Tier 3: History (JSONL) - append-only audit log
 *
 * @module agentic/memory-system
 */

import type {
  HistoryEventType,
  Memory,
  MemoryContext,
  MemoryRetrievalResult,
  Preference,
  RelevantMemoryQuery,
  Workflow,
} from '../types/memory'

import { HistoryStore, SessionStore } from './memory-stores'
import { PatternStore } from './pattern-store'
import { SemanticMemories } from './semantic-memories'

// =============================================================================
// Memory System (Main Class)
// =============================================================================

/**
 * Three-tier memory system for learning user patterns.
 * Tier 1: Session (ephemeral), Tier 2: Patterns (persistent), Tier 3: History (JSONL)
 */
export class MemorySystem {
  private _semanticMemories: SemanticMemories
  private _patternStore: PatternStore
  private _historyStore: HistoryStore
  private _sessionStore: SessionStore

  constructor() {
    this._semanticMemories = new SemanticMemories()
    this._patternStore = new PatternStore()
    this._historyStore = new HistoryStore()
    this._sessionStore = new SessionStore()
  }

  // ===========================================================================
  // P3.3: SEMANTIC MEMORIES
  // ===========================================================================

  loadMemories(projectId: string) {
    return this._semanticMemories.loadMemories(projectId)
  }

  saveMemories(projectId: string) {
    return this._semanticMemories.saveMemories(projectId)
  }

  createMemory(
    projectId: string,
    options: { title: string; content: string; tags?: string[]; userTriggered?: boolean }
  ): Promise<string> {
    return this._semanticMemories.createMemory(projectId, options)
  }

  updateMemory(
    projectId: string,
    memoryId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ): Promise<boolean> {
    return this._semanticMemories.updateMemory(projectId, memoryId, updates)
  }

  deleteMemory(projectId: string, memoryId: string): Promise<boolean> {
    return this._semanticMemories.deleteMemory(projectId, memoryId)
  }

  findByTags(projectId: string, tags: string[], matchAll?: boolean): Promise<Memory[]> {
    return this._semanticMemories.findByTags(projectId, tags, matchAll)
  }

  searchMemories(projectId: string, query: string): Promise<Memory[]> {
    return this._semanticMemories.searchMemories(projectId, query)
  }

  getRelevantMemories(
    projectId: string,
    context: MemoryContext,
    limit?: number
  ): Promise<Memory[]> {
    return this._semanticMemories.getRelevantMemories(projectId, context, limit)
  }

  autoRemember(
    projectId: string,
    decisionType: string,
    value: string,
    context?: string
  ): Promise<void> {
    return this._semanticMemories.autoRemember(projectId, decisionType, value, context)
  }

  getAllMemories(projectId: string): Promise<Memory[]> {
    return this._semanticMemories.getAllMemories(projectId)
  }

  getMemoryStats(projectId: string) {
    return this._semanticMemories.getMemoryStats(projectId)
  }

  /**
   * Get relevant memories with domain-based filtering and metrics.
   * Implements selective memory retrieval based on task relevance.
   * @see PRJ-107
   */
  getRelevantMemoriesWithMetrics(
    projectId: string,
    query: RelevantMemoryQuery
  ): Promise<MemoryRetrievalResult> {
    return this._semanticMemories.getRelevantMemoriesWithMetrics(projectId, query)
  }

  // ===========================================================================
  // TIER 1: Session Memory
  // ===========================================================================

  setSession(key: string, value: unknown): void {
    this._sessionStore.setSession(key, value)
  }

  getSession(key: string): unknown {
    return this._sessionStore.getSession(key)
  }

  clearSession(): void {
    this._sessionStore.clearSession()
  }

  // ===========================================================================
  // TIER 2: Patterns
  // ===========================================================================

  loadPatterns(projectId: string) {
    return this._patternStore.loadPatterns(projectId)
  }

  savePatterns(projectId: string) {
    return this._patternStore.savePatterns(projectId)
  }

  recordDecision(projectId: string, key: string, value: string, context?: string): Promise<void> {
    return this._patternStore.recordDecision(projectId, key, value, context)
  }

  getDecision(
    projectId: string,
    key: string
  ): Promise<{ value: string; confidence: string } | null> {
    return this._patternStore.getDecision(projectId, key)
  }

  hasPattern(projectId: string, key: string): Promise<boolean> {
    return this._patternStore.hasPattern(projectId, key)
  }

  recordWorkflow(
    projectId: string,
    workflowName: string,
    pattern: Record<string, unknown>
  ): Promise<void> {
    return this._patternStore.recordWorkflow(projectId, workflowName, pattern)
  }

  getWorkflow(projectId: string, workflowName: string): Promise<Workflow | null> {
    return this._patternStore.getWorkflow(projectId, workflowName)
  }

  setPreference(
    projectId: string,
    key: string,
    value: Preference['value'],
    options?: { userConfirmed?: boolean }
  ): Promise<void> {
    return this._patternStore.setPreference(projectId, key, value, options)
  }

  getPreference(projectId: string, key: string, defaultValue?: unknown): Promise<unknown> {
    return this._patternStore.getPreference(projectId, key, defaultValue)
  }

  confirmPreference(projectId: string, key: string): Promise<boolean> {
    return this._patternStore.confirmPreference(projectId, key)
  }

  confirmDecision(projectId: string, key: string): Promise<boolean> {
    return this._patternStore.confirmDecision(projectId, key)
  }

  confirmWorkflow(projectId: string, workflowName: string): Promise<boolean> {
    return this._patternStore.confirmWorkflow(projectId, workflowName)
  }

  getPatternsSummary(projectId: string) {
    return this._patternStore.getPatternsSummary(projectId)
  }

  archiveStaleDecisions(projectId: string): Promise<number> {
    return this._patternStore.archiveStaleDecisions(projectId)
  }

  // ===========================================================================
  // TIER 3: History
  // ===========================================================================

  appendHistory(
    projectId: string,
    entry: Record<string, unknown> & { type: HistoryEventType }
  ): Promise<void> {
    return this._historyStore.appendHistory(projectId, entry)
  }

  getRecentHistory(projectId: string, limit?: number) {
    return this._historyStore.getRecentHistory(projectId, limit)
  }

  // ===========================================================================
  // CONVENIENCE: Combined operations
  // ===========================================================================

  async getSmartDecision(projectId: string, key: string): Promise<string | null> {
    const sessionValue = this.getSession(`decision:${key}`)
    if (sessionValue !== undefined) return sessionValue as string

    const pattern = await this.getDecision(projectId, key)
    if (pattern) return pattern.value

    return null
  }

  async learnDecision(
    projectId: string,
    key: string,
    value: string,
    context: string = ''
  ): Promise<void> {
    this.setSession(`decision:${key}`, value)
    await this.recordDecision(projectId, key, value, context)
    await this.appendHistory(projectId, { type: 'decision', key, value, context })
  }

  /**
   * Reset internal state (for testing)
   */
  resetState(): void {
    this._sessionStore.clearSession()
    this._semanticMemories.reset()
    this._patternStore.reset()
  }
}

// =============================================================================
// Default Export
// =============================================================================

const memorySystem = new MemorySystem()
export default memorySystem
