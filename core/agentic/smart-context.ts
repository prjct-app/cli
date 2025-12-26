/**
 * Smart Context Compression
 *
 * Intelligently filters context based on task type.
 * Reduces prompt size by 40-70% while maintaining relevance.
 *
 * @module agentic/smart-context
 * @version 1.0
 */

import { agentPerformanceTracker } from '../agents'
import { outcomeAnalyzer } from '../outcomes'
import type { TaskType } from '../agents/types'
import type {
  ContextDomain,
  SmartContextProjectState,
  FullContext,
  FilteredContext,
  AgentInfo,
  FeatureInfo,
  PatternInfo,
  StackInfo,
  FilterMetrics,
  DomainAnalysis,
} from './agentic.types'

// Re-export types for convenience
export type {
  ContextDomain,
  FullContext,
  FilteredContext,
  AgentInfo,
  FeatureInfo,
  PatternInfo,
  StackInfo,
  FilterMetrics,
} from './agentic.types'

// Local type alias for backward compatibility
type ProjectState = SmartContextProjectState

/**
 * SmartContext - Intelligent context filtering.
 */
class SmartContext {
  /**
   * Detect the domain of a task from its description.
   */
  detectDomain(taskDescription: string): DomainAnalysis {
    const lower = taskDescription.toLowerCase()

    // Frontend indicators
    const frontendKeywords = [
      'ui', 'component', 'react', 'vue', 'angular', 'css', 'style',
      'button', 'form', 'modal', 'layout', 'responsive', 'animation',
      'dom', 'html', 'frontend', 'fe', 'client', 'browser', 'jsx', 'tsx'
    ]

    // Backend indicators
    const backendKeywords = [
      'api', 'server', 'database', 'db', 'endpoint', 'route', 'handler',
      'controller', 'service', 'repository', 'model', 'query', 'backend',
      'be', 'rest', 'graphql', 'prisma', 'sql', 'redis', 'auth'
    ]

    // DevOps indicators
    const devopsKeywords = [
      'deploy', 'docker', 'kubernetes', 'k8s', 'ci', 'cd', 'pipeline',
      'terraform', 'ansible', 'aws', 'gcp', 'azure', 'config', 'nginx',
      'devops', 'infrastructure', 'monitoring', 'logging', 'build'
    ]

    // Docs indicators
    const docsKeywords = [
      'document', 'docs', 'readme', 'changelog', 'comment', 'jsdoc',
      'tutorial', 'guide', 'explain', 'describe', 'markdown'
    ]

    // Testing indicators
    const testingKeywords = [
      'test', 'spec',
      // JS/TS
      'bun', 'bun test', 'jest', 'mocha', 'cypress', 'playwright',
      // Python
      'pytest', 'unittest',
      // Go
      'go test',
      // Rust
      'cargo test',
      // .NET
      'dotnet test',
      // Java
      'mvn test', 'gradle test', 'gradlew test',
      'e2e', 'unit', 'integration', 'coverage', 'mock', 'fixture'
    ]

    // Count matches
    const scores: Record<ContextDomain, number> = {
      frontend: frontendKeywords.filter(k => lower.includes(k)).length,
      backend: backendKeywords.filter(k => lower.includes(k)).length,
      devops: devopsKeywords.filter(k => lower.includes(k)).length,
      docs: docsKeywords.filter(k => lower.includes(k)).length,
      testing: testingKeywords.filter(k => lower.includes(k)).length,
      general: 0,
    }

    // Find primary and secondary domains
    const sorted = Object.entries(scores)
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])

    if (sorted.length === 0) {
      return { primary: 'general', secondary: [], confidence: 0.5 }
    }

    const primary = sorted[0][0] as ContextDomain
    const primaryScore = sorted[0][1]
    const secondary = sorted.slice(1, 3).map(([domain]) => domain as ContextDomain)

    // Calculate confidence based on score gap
    const totalScore = sorted.reduce((sum, [_, score]) => sum + score, 0)
    const confidence = totalScore > 0 ? Math.min(0.95, primaryScore / totalScore + 0.3) : 0.5

    return { primary, secondary, confidence }
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
    const filteredAgents = fullContext.agents.filter(
      agent => relevantDomains.includes(agent.domain)
    )

    // Enrich with performance data
    for (const agent of filteredAgents) {
      const perf = await agentPerformanceTracker.getAgentPerformance(
        projectId,
        agent.name
      )
      if (perf) {
        agent.successRate = perf.successRate
      }
    }

    // Filter roadmap
    const filteredRoadmap = fullContext.roadmap.filter(
      feature => feature.relatedTo.some(domain => relevantDomains.includes(domain))
    )

    // Filter patterns
    const filteredPatterns = fullContext.patterns.filter(
      pattern => relevantDomains.includes(pattern.domain)
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
    } catch {
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

    // Filter files by domain patterns
    const filteredFiles = this.filterFiles(fullContext.files, taskDomain)

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
      docs: [
        /\.(md|mdx|rst|txt)$/i,
        /docs?\//i,
        /readme/i,
        /changelog/i,
      ],
      testing: [
        /\.(test|spec)\./i,
        /tests?\//i,
        /__tests__\//i,
        /e2e\//i,
        /fixtures?\//i,
      ],
      general: [],
    }

    const domainPatterns = patterns[domain]
    if (domainPatterns.length === 0) {
      return files // Return all for general domain
    }

    // Always include config files
    const configPatterns = [
      /package\.json$/,
      /tsconfig\.json$/,
      /\.config\.(ts|js)$/,
    ]

    return files.filter(file => {
      // Include if matches domain patterns
      if (domainPatterns.some(p => p.test(file))) {
        return true
      }
      // Include config files
      if (configPatterns.some(p => p.test(file))) {
        return true
      }
      return false
    })
  }

  /**
   * Estimate context size in approximate tokens.
   */
  private estimateSize(context: Partial<{
    agents: unknown[]
    roadmap: unknown[]
    patterns: unknown[]
    stack: unknown
    files: string[]
    state: unknown
  }>): number {
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
    const agentSuggestion = await agentPerformanceTracker.suggestAgent(
      projectId,
      taskType
    )

    // Get duration estimate
    const durationEstimate = await outcomeAnalyzer.suggestEstimate(
      projectId,
      taskType
    )

    // Get relevant patterns
    const patterns = await outcomeAnalyzer.detectPatterns(projectId)
    const relevantPatterns = patterns
      .slice(0, 3)
      .map(p => p.description)

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
