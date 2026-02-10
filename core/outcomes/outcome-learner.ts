/**
 * Outcome Memory Learner (PRJ-283)
 *
 * Bridges the outcomes system to the memory system.
 * Extracts patterns from completed tasks and auto-injects
 * high-confidence learnings into semantic memory.
 *
 * Flow: Completed Tasks → Pattern Extraction → Memory Injection
 */

import type { SemanticMemories } from '../agentic/memory-system'
import type { FeatureOutcome } from '../schemas/outcomes'
import type { TaskHistoryEntry } from '../schemas/state'
import type { MemoryTag } from '../types/memory'
import { MEMORY_TAGS } from '../types/memory'
import { getTimestamp } from '../utils/date-helper'

// =============================================================================
// Types
// =============================================================================

/** A pattern extracted from outcome analysis */
export interface ExtractedPattern {
  /** Pattern description */
  pattern: string
  /** Number of times observed */
  occurrences: number
  /** Confidence: low (1-2), medium (3-4), high (5+) */
  confidence: 'low' | 'medium' | 'high'
  /** Category for memory tagging */
  category: PatternCategory
  /** Source tasks that contributed to this pattern */
  sourceTasks: string[]
}

export type PatternCategory =
  | 'file_cochange'
  | 'tech_stack'
  | 'architecture'
  | 'estimation'
  | 'workflow'
  | 'gotcha'

/** File co-change pattern: files that are frequently modified together */
export interface FileCochangePattern {
  /** File paths that change together */
  files: string[]
  /** Number of tasks where these files co-changed */
  occurrences: number
  /** Task types where this co-change happens */
  taskTypes: string[]
}

/** Result of auto-learning process */
export interface LearningResult {
  /** Patterns extracted */
  patternsExtracted: number
  /** Patterns that met confidence threshold */
  patternsQualified: number
  /** Memories created or updated */
  memoriesInjected: number
  /** Patterns below threshold (not injected) */
  patternsSkipped: number
  /** Details of what was learned */
  details: Array<{
    pattern: string
    action: 'created' | 'updated' | 'skipped'
    confidence: string
    reason?: string
  }>
}

// Minimum occurrences for auto-injection into memory
const CONFIDENCE_THRESHOLD = 3

// =============================================================================
// OutcomeMemoryLearner
// =============================================================================

export class OutcomeMemoryLearner {
  /**
   * Extract patterns from task history and inject high-confidence ones into memory.
   */
  async learnFromTaskHistory(
    projectId: string,
    taskHistory: TaskHistoryEntry[],
    semanticMemories: SemanticMemories
  ): Promise<LearningResult> {
    const result: LearningResult = {
      patternsExtracted: 0,
      patternsQualified: 0,
      memoriesInjected: 0,
      patternsSkipped: 0,
      details: [],
    }

    if (taskHistory.length === 0) return result

    // Extract all pattern types
    const patterns: ExtractedPattern[] = [
      ...this.extractFileCochangePatterns(taskHistory),
      ...this.extractStackPatterns(taskHistory),
      ...this.extractArchitecturePatterns(taskHistory),
      ...this.extractGotchaPatterns(taskHistory),
    ]

    result.patternsExtracted = patterns.length

    // Filter by confidence threshold and inject into memory
    for (const pattern of patterns) {
      if (pattern.occurrences >= CONFIDENCE_THRESHOLD) {
        result.patternsQualified++

        const injected = await this.injectIntoMemory(projectId, pattern, semanticMemories)

        if (injected) {
          result.memoriesInjected++
          result.details.push({
            pattern: pattern.pattern,
            action: injected.action,
            confidence: pattern.confidence,
          })
        }
      } else {
        result.patternsSkipped++
        result.details.push({
          pattern: pattern.pattern,
          action: 'skipped',
          confidence: pattern.confidence,
          reason: `${pattern.occurrences}/${CONFIDENCE_THRESHOLD} occurrences needed`,
        })
      }
    }

    return result
  }

  /**
   * Extract patterns from feature outcomes and inject into memory.
   */
  async learnFromOutcomes(
    projectId: string,
    outcomes: FeatureOutcome[],
    semanticMemories: SemanticMemories
  ): Promise<LearningResult> {
    const result: LearningResult = {
      patternsExtracted: 0,
      patternsQualified: 0,
      memoriesInjected: 0,
      patternsSkipped: 0,
      details: [],
    }

    if (outcomes.length === 0) return result

    const patterns = this.extractOutcomePatterns(outcomes)
    result.patternsExtracted = patterns.length

    for (const pattern of patterns) {
      if (pattern.occurrences >= CONFIDENCE_THRESHOLD) {
        result.patternsQualified++

        const injected = await this.injectIntoMemory(projectId, pattern, semanticMemories)
        if (injected) {
          result.memoriesInjected++
          result.details.push({
            pattern: pattern.pattern,
            action: injected.action,
            confidence: pattern.confidence,
          })
        }
      } else {
        result.patternsSkipped++
        result.details.push({
          pattern: pattern.pattern,
          action: 'skipped',
          confidence: pattern.confidence,
          reason: `${pattern.occurrences}/${CONFIDENCE_THRESHOLD} occurrences needed`,
        })
      }
    }

    return result
  }

  // ===========================================================================
  // Pattern Extraction
  // ===========================================================================

  /**
   * Extract file co-change patterns from task history.
   * Files that frequently change together indicate architectural coupling.
   */
  extractFileCochangePatterns(taskHistory: TaskHistoryEntry[]): ExtractedPattern[] {
    const cochangeMap = new Map<string, { count: number; tasks: string[] }>()

    for (const task of taskHistory) {
      if (!task.subtaskSummaries) continue

      // Collect all files changed across subtasks in this task
      const filesChanged = new Set<string>()
      for (const subtask of task.subtaskSummaries) {
        if (subtask.filesChanged) {
          for (const file of subtask.filesChanged) {
            filesChanged.add(file.path)
          }
        }
      }

      // Generate pairs of co-changed files
      const fileList = Array.from(filesChanged).sort()
      for (let i = 0; i < fileList.length; i++) {
        for (let j = i + 1; j < fileList.length; j++) {
          const key = `${fileList[i]}|${fileList[j]}`
          const entry = cochangeMap.get(key) || { count: 0, tasks: [] }
          entry.count++
          entry.tasks.push(task.taskId)
          cochangeMap.set(key, entry)
        }
      }
    }

    // Convert to patterns (only pairs seen 2+ times)
    const patterns: ExtractedPattern[] = []
    for (const [key, { count, tasks }] of cochangeMap) {
      if (count >= 2) {
        const [file1, file2] = key.split('|')
        patterns.push({
          pattern: `Files "${file1}" and "${file2}" frequently change together (${count} tasks)`,
          occurrences: count,
          confidence: this.calculateConfidence(count),
          category: 'file_cochange',
          sourceTasks: tasks,
        })
      }
    }

    return patterns.sort((a, b) => b.occurrences - a.occurrences)
  }

  /**
   * Extract tech stack patterns from task feedback.
   */
  extractStackPatterns(taskHistory: TaskHistoryEntry[]): ExtractedPattern[] {
    const stackCounts = new Map<string, { count: number; tasks: string[] }>()

    for (const task of taskHistory) {
      if (!task.feedback?.stackConfirmed) continue

      for (const stack of task.feedback.stackConfirmed) {
        const entry = stackCounts.get(stack) || { count: 0, tasks: [] }
        entry.count++
        entry.tasks.push(task.taskId)
        stackCounts.set(stack, entry)
      }
    }

    return Array.from(stackCounts.entries()).map(([stack, { count, tasks }]) => ({
      pattern: `Project uses ${stack}`,
      occurrences: count,
      confidence: this.calculateConfidence(count),
      category: 'tech_stack' as PatternCategory,
      sourceTasks: tasks,
    }))
  }

  /**
   * Extract architecture patterns from discovered patterns in feedback.
   */
  extractArchitecturePatterns(taskHistory: TaskHistoryEntry[]): ExtractedPattern[] {
    const patternCounts = new Map<string, { count: number; tasks: string[] }>()

    for (const task of taskHistory) {
      if (!task.feedback?.patternsDiscovered) continue

      for (const pattern of task.feedback.patternsDiscovered) {
        const entry = patternCounts.get(pattern) || { count: 0, tasks: [] }
        entry.count++
        entry.tasks.push(task.taskId)
        patternCounts.set(pattern, entry)
      }
    }

    return Array.from(patternCounts.entries()).map(([pattern, { count, tasks }]) => ({
      pattern,
      occurrences: count,
      confidence: this.calculateConfidence(count),
      category: 'architecture' as PatternCategory,
      sourceTasks: tasks,
    }))
  }

  /**
   * Extract gotcha patterns from issues encountered.
   * Issues seen 2+ times become gotchas.
   */
  extractGotchaPatterns(taskHistory: TaskHistoryEntry[]): ExtractedPattern[] {
    const issueCounts = new Map<string, { count: number; tasks: string[] }>()

    for (const task of taskHistory) {
      if (!task.feedback?.issuesEncountered) continue

      for (const issue of task.feedback.issuesEncountered) {
        const entry = issueCounts.get(issue) || { count: 0, tasks: [] }
        entry.count++
        entry.tasks.push(task.taskId)
        issueCounts.set(issue, entry)
      }
    }

    return Array.from(issueCounts.entries())
      .filter(([_, { count }]) => count >= 2)
      .map(([issue, { count, tasks }]) => ({
        pattern: `Known gotcha: ${issue}`,
        occurrences: count,
        confidence: this.calculateConfidence(count),
        category: 'gotcha' as PatternCategory,
        sourceTasks: tasks,
      }))
  }

  /**
   * Extract patterns from feature outcomes (learnings, estimation, etc.)
   */
  extractOutcomePatterns(outcomes: FeatureOutcome[]): ExtractedPattern[] {
    const patterns: ExtractedPattern[] = []

    // Aggregate learnings
    const whatWorkedCounts = new Map<string, { count: number; ids: string[] }>()
    const whatDidntCounts = new Map<string, { count: number; ids: string[] }>()

    for (const outcome of outcomes) {
      for (const learning of outcome.learnings.whatWorked) {
        const entry = whatWorkedCounts.get(learning) || { count: 0, ids: [] }
        entry.count++
        entry.ids.push(outcome.id)
        whatWorkedCounts.set(learning, entry)
      }
      for (const learning of outcome.learnings.whatDidnt) {
        const entry = whatDidntCounts.get(learning) || { count: 0, ids: [] }
        entry.count++
        entry.ids.push(outcome.id)
        whatDidntCounts.set(learning, entry)
      }
    }

    for (const [learning, { count, ids }] of whatWorkedCounts) {
      patterns.push({
        pattern: `What works: ${learning}`,
        occurrences: count,
        confidence: this.calculateConfidence(count),
        category: 'workflow',
        sourceTasks: ids,
      })
    }

    for (const [learning, { count, ids }] of whatDidntCounts) {
      patterns.push({
        pattern: `Known issue: ${learning}`,
        occurrences: count,
        confidence: this.calculateConfidence(count),
        category: 'gotcha',
        sourceTasks: ids,
      })
    }

    // Estimation accuracy pattern
    const underestimated = outcomes.filter((o) => o.effort.variance.percentage > 30)
    if (underestimated.length >= CONFIDENCE_THRESHOLD) {
      patterns.push({
        pattern: `Tasks are frequently underestimated (${underestimated.length}/${outcomes.length} over 30% variance)`,
        occurrences: underestimated.length,
        confidence: this.calculateConfidence(underestimated.length),
        category: 'estimation',
        sourceTasks: underestimated.map((o) => o.id),
      })
    }

    return patterns
  }

  /**
   * Get all extracted patterns without injecting into memory.
   * Useful for the `p. learnings` command.
   */
  getAllPatterns(
    taskHistory: TaskHistoryEntry[],
    outcomes: FeatureOutcome[] = []
  ): ExtractedPattern[] {
    return [
      ...this.extractFileCochangePatterns(taskHistory),
      ...this.extractStackPatterns(taskHistory),
      ...this.extractArchitecturePatterns(taskHistory),
      ...this.extractGotchaPatterns(taskHistory),
      ...this.extractOutcomePatterns(outcomes),
    ].sort((a, b) => b.occurrences - a.occurrences)
  }

  // ===========================================================================
  // Memory Injection
  // ===========================================================================

  /**
   * Inject a pattern into semantic memory.
   * Creates a new memory or updates existing one.
   * All auto-learned entries are tagged with source: auto-learned.
   */
  private async injectIntoMemory(
    projectId: string,
    pattern: ExtractedPattern,
    semanticMemories: SemanticMemories
  ): Promise<{ action: 'created' | 'updated' } | null> {
    const tags = this.getTagsForCategory(pattern.category)
    const title = `[auto-learned] ${this.getTitleForPattern(pattern)}`
    const content = this.formatPatternContent(pattern)

    // Check if a similar memory already exists
    const existing = await semanticMemories.searchMemories(projectId, pattern.pattern)
    const autoLearnedMatch = existing.find(
      (m) => m.title.startsWith('[auto-learned]') && m.content.includes(pattern.pattern)
    )

    if (autoLearnedMatch) {
      // Update existing memory with new observation count
      await semanticMemories.updateMemory(projectId, autoLearnedMatch.id, {
        content,
        tags,
      })
      return { action: 'updated' }
    }

    // Create new memory
    await semanticMemories.createMemory(projectId, {
      title,
      content,
      tags,
      userTriggered: false,
    })

    return { action: 'created' }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private calculateConfidence(count: number): 'low' | 'medium' | 'high' {
    if (count >= 5) return 'high'
    if (count >= 3) return 'medium'
    return 'low'
  }

  private getTagsForCategory(category: PatternCategory): string[] {
    const tagMap: Record<PatternCategory, MemoryTag[]> = {
      file_cochange: [MEMORY_TAGS.FILE_STRUCTURE, MEMORY_TAGS.ARCHITECTURE],
      tech_stack: [MEMORY_TAGS.TECH_STACK],
      architecture: [MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.CODE_STYLE],
      estimation: [MEMORY_TAGS.SHIP_WORKFLOW],
      workflow: [MEMORY_TAGS.SHIP_WORKFLOW, MEMORY_TAGS.CODE_STYLE],
      gotcha: [MEMORY_TAGS.TEST_BEHAVIOR, MEMORY_TAGS.ARCHITECTURE],
    }
    return tagMap[category] || []
  }

  private getTitleForPattern(pattern: ExtractedPattern): string {
    const prefixes: Record<PatternCategory, string> = {
      file_cochange: 'File coupling',
      tech_stack: 'Tech stack',
      architecture: 'Architecture pattern',
      estimation: 'Estimation insight',
      workflow: 'Workflow pattern',
      gotcha: 'Known gotcha',
    }
    return `${prefixes[pattern.category]}: ${pattern.pattern.slice(0, 80)}`
  }

  private formatPatternContent(pattern: ExtractedPattern): string {
    const lines = [
      `source: auto-learned`,
      `pattern: ${pattern.pattern}`,
      `occurrences: ${pattern.occurrences}`,
      `confidence: ${pattern.confidence}`,
      `category: ${pattern.category}`,
      `last_updated: ${getTimestamp()}`,
    ]

    if (pattern.sourceTasks.length > 0) {
      lines.push(`source_tasks: ${pattern.sourceTasks.slice(0, 5).join(', ')}`)
    }

    return lines.join('\n')
  }
}

export const outcomeMemoryLearner = new OutcomeMemoryLearner()
export default outcomeMemoryLearner
