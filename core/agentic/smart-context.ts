/**
 * Smart Context Compression
 *
 * Intelligently filters context based on task type.
 * Reduces prompt size by 40-70% while maintaining relevance.
 *
 * Uses LLM-based domain classification (PRJ-299) instead of keyword matching.
 *
 * @module agentic/smart-context
 * @version 2.0
 */

import { hasIndexes, rankFiles } from '../domain/file-ranker'
import type {
  ContextDomain,
  DomainAnalysis,
  FilteredContext,
  FullContext,
  SmartContextProjectState,
  StackInfo,
} from '../types/agentic'
import type { TaskType } from '../types/agents'
import outcomeAnalyzer from '../workflows/outcome-analyzer'
import domainClassifier, { classifyWithHeuristic, type ProjectContext } from './domain-classifier'
import agentPerformanceTracker from './performance'

export type {
  ContextDomain,
  FeatureInfo,
  FilteredContext,
  FilterMetrics,
  FullContext,
  PatternInfo,
  StackInfo,
} from '../types/agentic'
// Re-export types for convenience
export type { AgentInfo } from '../types/agents'

export type ProjectState = SmartContextProjectState

// Map ClassificationDomain → ContextDomain
function toContextDomain(domain: string): ContextDomain {
  const mapping: Record<string, ContextDomain> = {
    frontend: 'frontend',
    backend: 'backend',
    database: 'backend', // database maps to backend context domain
    devops: 'devops',
    testing: 'testing',
    docs: 'docs',
    uxui: 'frontend', // uxui maps to frontend context domain
    general: 'general',
  }
  return mapping[domain] || 'general'
}

/**
 * SmartContext - Intelligent context filtering.
 */
class SmartContext {
  /**
   * Detect the domain of a task from its description.
   *
   * Synchronous version using the improved heuristic (word-boundary matching).
   * For full LLM-based classification, use classifyDomain().
   */
  detectDomain(taskDescription: string): DomainAnalysis {
    // Default context when no project info is available
    const defaultContext: ProjectContext = {
      domains: {
        hasFrontend: true,
        hasBackend: true,
        hasDatabase: true,
        hasTesting: true,
        hasDocker: true,
      },
      agents: [],
    }

    const result = classifyWithHeuristic(taskDescription, defaultContext)

    return {
      primary: toContextDomain(result.primaryDomain),
      secondary: result.secondaryDomains.map(toContextDomain),
      confidence: result.confidence,
    }
  }

  /**
   * Classify domain using the full fallback chain (cache → history → LLM → heuristic).
   * Async version that leverages project context and LLM classification.
   */
  async classifyDomain(
    taskDescription: string,
    projectId: string,
    globalPath: string,
    context: ProjectContext
  ): Promise<DomainAnalysis & { source: string }> {
    const { classification, source } = await domainClassifier.classify(
      taskDescription,
      projectId,
      globalPath,
      context
    )

    return {
      primary: toContextDomain(classification.primaryDomain),
      secondary: classification.secondaryDomains.map(toContextDomain),
      confidence: classification.confidence,
      source,
    }
  }

  /**
   * Filter context for a specific task type.
   */
  async filterForTask(
    fullContext: FullContext,
    taskDescription: string,
    projectId: string
  ): Promise<FilteredContext> {
    const domainAnalysis = this.detectDomain(taskDescription)
    const { primary: taskDomain, secondary } = domainAnalysis

    // Include primary and secondary domains
    const relevantDomains = [taskDomain, ...secondary, 'general']

    // Filter agents
    const filteredAgents = fullContext.agents.filter((agent) =>
      relevantDomains.includes(agent.domain)
    )

    // Enrich with performance data
    for (const agent of filteredAgents) {
      const perf = await agentPerformanceTracker.getAgentPerformance(projectId, agent.name)
      if (perf) {
        agent.successRate = perf.successRate
      }
    }

    // Filter roadmap
    const filteredRoadmap = fullContext.roadmap.filter((feature) =>
      feature.relatedTo.some((domain) => relevantDomains.includes(domain))
    )

    // Filter patterns
    const filteredPatterns = fullContext.patterns.filter((pattern) =>
      relevantDomains.includes(pattern.domain)
    )

    // Get relevant patterns from outcomes
    try {
      const outcomePatterns = await outcomeAnalyzer.detectPatterns(projectId)
      for (const pattern of outcomePatterns.slice(0, 3)) {
        filteredPatterns.push({
          description: pattern.description,
          domain: taskDomain,
          confidence: pattern.confidence,
        })
      }
    } catch (_error) {
      // Outcomes not available
    }

    // Filter stack
    const filteredStack: Partial<StackInfo> = {}
    if (relevantDomains.includes('frontend')) {
      filteredStack.frontend = fullContext.stack.frontend
    }
    if (relevantDomains.includes('backend')) {
      filteredStack.backend = fullContext.stack.backend
      filteredStack.database = fullContext.stack.database
    }
    if (relevantDomains.includes('devops')) {
      filteredStack.devops = fullContext.stack.devops
    }
    if (relevantDomains.includes('testing')) {
      filteredStack.testing = fullContext.stack.testing
    }

    // Filter files: use BM25 ranker if indexes exist, else fall back to domain patterns
    const filteredFiles = this.rankOrFilterFiles(
      fullContext.files,
      taskDescription,
      projectId,
      taskDomain
    )

    // Calculate metrics
    const originalSize = this.estimateSize(fullContext)
    const filteredSize = this.estimateSize({
      agents: filteredAgents,
      roadmap: filteredRoadmap,
      patterns: filteredPatterns,
      stack: filteredStack,
      files: filteredFiles,
    })

    return {
      agents: filteredAgents,
      roadmap: filteredRoadmap,
      patterns: filteredPatterns,
      stack: filteredStack,
      files: filteredFiles,
      metrics: {
        originalSize,
        filteredSize,
        reductionPercent: Math.round((1 - filteredSize / originalSize) * 100),
        domain: taskDomain,
      },
    }
  }

  /**
   * Use BM25 + import graph + co-change ranking if indexes exist,
   * otherwise fall back to regex-based domain filtering.
   */
  private rankOrFilterFiles(
    files: string[],
    taskDescription: string,
    projectId: string,
    domain: ContextDomain
  ): string[] {
    try {
      const indexes = hasIndexes(projectId)
      if (indexes.bm25) {
        const ranked = rankFiles(projectId, taskDescription, { topN: 15 })
        if (ranked.length > 0) {
          return ranked.map((r) => r.path)
        }
      }
    } catch {
      // Index not available — fall through to regex filter
    }

    return this.filterFiles(files, domain)
  }

  /**
   * Filter files by domain.
   */
  private filterFiles(files: string[], domain: ContextDomain): string[] {
    const patterns: Record<ContextDomain, RegExp[]> = {
      frontend: [
        /\.(tsx?|jsx?|vue|svelte)$/,
        /components?\//i,
        /pages?\//i,
        /views?\//i,
        /styles?\//i,
        /hooks?\//i,
      ],
      backend: [
        /\.(ts|js|py|go|rs|java)$/,
        /api\//i,
        /routes?\//i,
        /controllers?\//i,
        /services?\//i,
        /models?\//i,
        /handlers?\//i,
      ],
      devops: [
        /\.(ya?ml|toml|dockerfile|tf)$/i,
        /docker/i,
        /\.github\//i,
        /deploy/i,
        /infra/i,
        /k8s/i,
      ],
      docs: [/\.(md|mdx|rst|txt)$/i, /docs?\//i, /readme/i, /changelog/i],
      testing: [/\.(test|spec)\./i, /tests?\//i, /__tests__\//i, /e2e\//i, /fixtures?\//i],
      general: [],
    }

    const domainPatterns = patterns[domain]
    if (domainPatterns.length === 0) {
      return files // Return all for general domain
    }

    // Always include config files
    const configPatterns = [/package\.json$/, /tsconfig\.json$/, /\.config\.(ts|js)$/]

    return files.filter((file) => {
      // Include if matches domain patterns
      if (domainPatterns.some((p) => p.test(file))) {
        return true
      }
      // Include config files
      if (configPatterns.some((p) => p.test(file))) {
        return true
      }
      return false
    })
  }

  /**
   * Estimate context size in approximate tokens.
   */
  private estimateSize(
    context: Partial<{
      agents: unknown[]
      roadmap: unknown[]
      patterns: unknown[]
      stack: unknown
      files: string[]
      state: unknown
    }>
  ): number {
    let size = 0

    // Rough estimates: each item ~50 tokens, files ~10 tokens each
    size += (context.agents?.length || 0) * 50
    size += (context.roadmap?.length || 0) * 50
    size += (context.patterns?.length || 0) * 30
    size += context.stack ? 100 : 0
    size += (context.files?.length || 0) * 10
    size += context.state ? 200 : 0

    return Math.max(100, size)
  }

  /**
   * Convert TaskType to ContextDomain.
   */
  taskTypeToContextDomain(taskType: TaskType): ContextDomain {
    const mapping: Record<TaskType, ContextDomain> = {
      frontend: 'frontend',
      backend: 'backend',
      devops: 'devops',
      database: 'backend',
      testing: 'testing',
      documentation: 'docs',
      refactoring: 'general',
      bugfix: 'general',
      feature: 'general',
      design: 'frontend',
      other: 'general',
    }
    return mapping[taskType]
  }

  /**
   * Get recommended context for a task based on history.
   */
  async getRecommendedContext(
    projectId: string,
    taskDescription: string
  ): Promise<{
    domain: ContextDomain
    suggestedAgent: string | null
    estimatedDuration: string | null
    patterns: string[]
  }> {
    const domainAnalysis = this.detectDomain(taskDescription)
    const taskType = this.contextDomainToTaskType(domainAnalysis.primary)

    // Get agent suggestion
    const agentSuggestion = await agentPerformanceTracker.suggestAgent(projectId, taskType)

    // Get duration estimate
    const durationEstimate = await outcomeAnalyzer.suggestEstimate(projectId, taskType)

    // Get relevant patterns
    const patterns = await outcomeAnalyzer.detectPatterns(projectId)
    const relevantPatterns = patterns.slice(0, 3).map((p) => p.description)

    return {
      domain: domainAnalysis.primary,
      suggestedAgent: agentSuggestion?.agentName || null,
      estimatedDuration: durationEstimate,
      patterns: relevantPatterns,
    }
  }

  /**
   * Convert ContextDomain to TaskType.
   */
  private contextDomainToTaskType(domain: ContextDomain): TaskType {
    const mapping: Record<ContextDomain, TaskType> = {
      frontend: 'frontend',
      backend: 'backend',
      devops: 'devops',
      docs: 'documentation',
      testing: 'testing',
      general: 'other',
    }
    return mapping[domain]
  }
}

// Singleton instance
const smartContext = new SmartContext()
export default smartContext
export { SmartContext }
