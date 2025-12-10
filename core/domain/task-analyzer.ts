/**
 * TaskAnalyzer - Deep Semantic Task Analysis
 *
 * Analyzes tasks semantically, not just keywords
 * Considers project context, history, and relationships
 *
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import analyzer from './analyzer'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'

interface Task {
  description?: string
  type?: string
}

interface HistoryEntry {
  type: string
  domain?: string
  description?: string
}

interface SemanticAnalysis {
  intent: string | null
  requiresMultipleAgents: boolean
  text: string
}

interface HistoricalAnalysis {
  confidence: number
  patterns: Array<{ domain: string; description: string }>
  suggestedDomain?: string | null
}

interface ProjectData {
  packageJson: unknown
  extensions: Record<string, number>
  directories: string[]
  configFiles: string[]
}

interface TaskAnalysisResult {
  primaryDomain: string
  confidence: number
  semantic: SemanticAnalysis
  historical: HistoricalAnalysis
  complexity: string
  projectData: ProjectData
  matchedKeywords: string[]
  reason: string
  alternatives: string[]
}

class TaskAnalyzer {
  projectPath: string
  projectId: string | null = null
  taskHistory: HistoryEntry[] | null = null

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  /**
   * Initialize analyzer with project context
   */
  async initialize(): Promise<void> {
    this.projectId = await configManager.getProjectId(this.projectPath)
    analyzer.init(this.projectPath)
    await this.loadTaskHistory()
  }

  /**
   * Deep semantic analysis of a task
   *
   * 100% AGENTIC: No hardcoded patterns. Uses task description
   * and historical patterns only. Claude decides domain relevance.
   */
  async analyzeTask(task: Task): Promise<TaskAnalysisResult> {
    if (!this.projectId) {
      await this.initialize()
    }

    const description = (task.description || '').toLowerCase()
    const type = (task.type || '').toLowerCase()
    const fullText = `${description} ${type}`.trim()

    // Get raw project data (no categorization)
    const projectData: ProjectData = {
      packageJson: await analyzer.readPackageJson(),
      extensions: await analyzer.getFileExtensions(),
      directories: await analyzer.listDirectories(),
      configFiles: await analyzer.listConfigFiles(),
    }

    // Semantic understanding (intent-based, not keyword-based)
    const semantic = this.analyzeSemantics(fullText)

    // Historical patterns
    const historical = await this.analyzeHistory(fullText)

    // Complexity estimation
    const complexity = this.estimateComplexity(fullText)

    // Primary domain from history and intent (not hardcoded patterns)
    const primaryDomain = this.selectPrimaryDomain(semantic, historical)
    const confidence = this.calculateConfidence(semantic, historical)

    return {
      primaryDomain,
      confidence,
      semantic,
      historical,
      complexity,
      projectData, // Raw data for Claude to analyze
      matchedKeywords: [], // No keyword matching - Claude decides
      reason: this.buildReason(primaryDomain, semantic, historical),
      alternatives: ['full-stack', 'generalist'],
    }
  }

  /**
   * Domain detection removed - 100% AGENTIC
   *
   * NO hardcoded keyword lists or framework categorization.
   * Claude analyzes the task description and project context
   * to determine the appropriate domain.
   *
   * This method is kept for backward compatibility but returns empty.
   * Use analyzeTask() which provides raw data for Claude.
   */
  detectDomains(text: string): Record<string, unknown> {
    // No hardcoded patterns - Claude decides domain
    return {}
  }

  /**
   * Semantic analysis - understand intent
   * AGENTIC: Claude uses templates/analysis/intent.md for detailed analysis
   * This returns minimal structure - Claude determines actual intent
   */
  analyzeSemantics(text: string): SemanticAnalysis {
    // AGENTIC: Return structure only, Claude analyzes via template
    return {
      intent: null, // Claude determines via templates/analysis/intent.md
      requiresMultipleAgents: false, // Claude decides based on context
      text: text, // Pass text for Claude to analyze
    }
  }

  /**
   * Analyze historical patterns
   */
  async analyzeHistory(text: string): Promise<HistoricalAnalysis> {
    if (!this.taskHistory) {
      return { confidence: 0, patterns: [] }
    }

    // Find similar tasks in history
    const similar = this.taskHistory.filter((task) => {
      const similarity = this.calculateTextSimilarity(text, task.description || '')
      return similarity > 0.5
    })

    if (similar.length === 0) {
      return { confidence: 0, patterns: [] }
    }

    // Find most common domain for similar tasks
    const domainCounts: Record<string, number> = {}
    similar.forEach((task) => {
      if (task.domain) {
        domainCounts[task.domain] = (domainCounts[task.domain] || 0) + 1
      }
    })

    const mostCommon = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0]

    return {
      confidence: mostCommon ? mostCommon[1] / similar.length : 0,
      patterns: similar.map((t) => ({ domain: t.domain || '', description: t.description || '' })),
      suggestedDomain: mostCommon ? mostCommon[0] : null,
    }
  }

  /**
   * Estimate task complexity
   * AGENTIC: Claude uses templates/analysis/complexity.md for real estimation
   * This returns default - Claude determines actual complexity
   */
  estimateComplexity(text: string): string {
    // AGENTIC: Return default, Claude analyzes via templates/analysis/complexity.md
    return 'medium'
  }

  /**
   * Select primary domain from history and semantics
   *
   * 100% AGENTIC: No keyword matching. Uses only:
   * - Historical patterns from past tasks
   * - Basic intent detection
   * Claude decides actual domain based on project context.
   */
  selectPrimaryDomain(semantic: SemanticAnalysis, historical: HistoricalAnalysis): string {
    // Priority: historical > default
    if (historical && historical.suggestedDomain && historical.confidence > 0.7) {
      return historical.suggestedDomain
    }

    // Map intent to suggested domain (loose mapping, Claude refines)
    if (semantic && semantic.intent === 'test') {
      return 'qa'
    }

    // Default: generalist (Claude decides based on context)
    return 'generalist'
  }

  /**
   * Calculate confidence based on available signals
   */
  calculateConfidence(semantic: SemanticAnalysis, historical: HistoricalAnalysis): number {
    let confidence = 0.5 // Base confidence

    // Boost from historical patterns
    if (historical && historical.confidence > 0) {
      confidence += historical.confidence * 0.3
    }

    // Boost from semantic understanding
    if (semantic && semantic.intent) {
      confidence += 0.1
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * Build human-readable reason
   */
  buildReason(primaryDomain: string, semantic: SemanticAnalysis, historical: HistoricalAnalysis): string {
    const parts: string[] = []

    if (historical && historical.suggestedDomain && historical.confidence > 0.7) {
      parts.push(`Historical: similar tasks used ${primaryDomain}`)
    }

    if (semantic && semantic.intent) {
      parts.push(`Intent: ${semantic.intent}`)
    }

    return parts.join(' | ') || 'Claude will analyze task in context'
  }

  /**
   * Load task history from memory
   */
  async loadTaskHistory(): Promise<void> {
    try {
      const memoryPath = pathManager.getFilePath(this.projectId!, 'memory', 'context.jsonl')
      const content = await fs.readFile(memoryPath, 'utf-8')
      const lines = content.split('\n').filter(Boolean)

      this.taskHistory = lines
        .map((line) => {
          try {
            return JSON.parse(line) as HistoryEntry
          } catch {
            return null
          }
        })
        .filter((entry): entry is HistoryEntry => entry !== null && entry.type === 'task_start' && !!entry.domain)
        .slice(-100) // Last 100 tasks
    } catch {
      this.taskHistory = []
    }
  }

  /**
   * Calculate text similarity (simple Jaccard)
   */
  calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter((w) => words2.has(w)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }
}

export default TaskAnalyzer
