/**
 * TaskAnalyzer - Deep Semantic Task Analysis
 * 
 * Analyzes tasks semantically, not just keywords
 * Considers project context, history, and relationships
 * 
 * @version 1.0.0
 */

const fs = require('fs').promises
const path = require('path')
const TechDetector = require('./tech-detector')
const configManager = require('../infrastructure/config-manager')
const pathManager = require('../infrastructure/path-manager')

class TaskAnalyzer {
  constructor(projectPath) {
    this.projectPath = projectPath
    this.projectId = null
    this.techDetector = null
    this.taskHistory = null
  }

  /**
   * Initialize analyzer with project context
   */
  async initialize() {
    this.projectId = await configManager.getProjectId(this.projectPath)
    this.techDetector = new TechDetector(this.projectPath)
    await this.loadTaskHistory()
  }

  /**
   * Deep semantic analysis of a task
   * @param {Object} task - Task object {description, type}
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeTask(task) {
    if (!this.techDetector) {
      await this.initialize()
    }

    const description = (task.description || '').toLowerCase()
    const type = (task.type || '').toLowerCase()
    const fullText = `${description} ${type}`.trim()

    // Get project technologies
    const projectTech = await this.techDetector.detectAll()

    // Multi-domain detection
    const domains = this.detectDomains(fullText, projectTech)

    // Semantic understanding
    const semantic = this.analyzeSemantics(fullText, projectTech)

    // Historical patterns
    const historical = await this.analyzeHistory(fullText)

    // Complexity estimation
    const complexity = this.estimateComplexity(fullText, domains)

    // Combine all signals
    const primaryDomain = this.selectPrimaryDomain(domains, semantic, historical)
    const confidence = this.calculateConfidence(domains, semantic, historical)

    return {
      primaryDomain,
      domains, // All detected domains
      confidence,
      semantic,
      historical,
      complexity,
      projectTechnologies: projectTech,
      matchedKeywords: domains[primaryDomain]?.keywords || [],
      reason: this.buildReason(primaryDomain, domains, semantic, historical),
      alternatives: this.getAlternatives(primaryDomain, domains)
    }
  }

  /**
   * Detect multiple domains from task description
   */
  detectDomains(text, projectTech) {
    const domains = {}

    // Enhanced patterns with project context
    const patterns = {
      frontend: [
        'component', 'ui', 'user interface', 'frontend', 'client',
        'style', 'css', 'layout', 'responsive', 'design',
        'page', 'view', 'template', 'render', 'display',
        'button', 'form', 'input', 'modal', 'dialog',
        ...(projectTech.frameworks.filter(f => ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt'].includes(f.toLowerCase())).map(f => f.toLowerCase()))
      ],
      backend: [
        'api', 'server', 'endpoint', 'route', 'middleware',
        'auth', 'authentication', 'authorization', 'jwt', 'session',
        'backend', 'service', 'controller', 'handler',
        'database', 'query', 'model', 'schema',
        ...(projectTech.frameworks.filter(f => ['express', 'fastify', 'django', 'flask', 'rails', 'phoenix'].includes(f.toLowerCase())).map(f => f.toLowerCase()))
      ],
      database: [
        'database', 'db', 'query', 'migration', 'schema', 'model',
        'sql', 'data', 'table', 'collection', 'index', 'relation',
        'postgres', 'mysql', 'mongodb', 'redis'
      ],
      devops: [
        'deploy', 'deployment', 'docker', 'kubernetes', 'k8s',
        'ci/cd', 'pipeline', 'build', 'ship', 'release',
        'production', 'infrastructure', 'container', 'orchestration'
      ],
      qa: [
        'test', 'testing', 'bug', 'error', 'fix', 'debug', 'issue',
        'quality', 'coverage', 'unit test', 'integration test',
        'e2e', 'spec', 'assertion', 'validation'
      ],
      architecture: [
        'design', 'architecture', 'pattern', 'structure',
        'refactor', 'refactoring', 'organize', 'plan',
        'feature', 'system', 'module', 'component design'
      ]
    }

    // Score each domain
    for (const [domain, keywords] of Object.entries(patterns)) {
      const matches = keywords.filter(keyword => text.includes(keyword))
      if (matches.length > 0) {
        domains[domain] = {
          keywords: matches,
          count: matches.length,
          score: matches.length + (matches.length > 2 ? 1 : 0) // Bonus for multiple matches
        }
      }
    }

    return domains
  }

  /**
   * Semantic analysis - understand intent, not just keywords
   */
  analyzeSemantics(text, projectTech) {
    const semantic = {
      intent: null,
      requiresMultipleAgents: false,
      complexity: 'medium'
    }

    // Detect intent patterns
    if (text.match(/\b(create|add|build|implement|make)\b/)) {
      semantic.intent = 'create'
    } else if (text.match(/\b(fix|repair|debug|resolve)\b/)) {
      semantic.intent = 'fix'
    } else if (text.match(/\b(improve|optimize|enhance|refactor)\b/)) {
      semantic.intent = 'improve'
    } else if (text.match(/\b(test|verify|validate)\b/)) {
      semantic.intent = 'test'
    }

    // Detect multi-agent requirements
    if (text.match(/\b(api|endpoint).*\b(test|spec)\b/) || 
        text.match(/\b(test|spec).*\b(api|endpoint)\b/)) {
      semantic.requiresMultipleAgents = true
      semantic.agents = ['backend', 'qa']
    }

    if (text.match(/\b(component|ui).*\b(test|spec)\b/) ||
        text.match(/\b(test|spec).*\b(component|ui)\b/)) {
      semantic.requiresMultipleAgents = true
      semantic.agents = ['frontend', 'qa']
    }

    return semantic
  }

  /**
   * Analyze historical patterns
   */
  async analyzeHistory(text) {
    if (!this.taskHistory) {
      return { confidence: 0, patterns: [] }
    }

    // Find similar tasks in history
    const similar = this.taskHistory.filter(task => {
      const similarity = this.calculateTextSimilarity(text, task.description)
      return similarity > 0.5
    })

    if (similar.length === 0) {
      return { confidence: 0, patterns: [] }
    }

    // Find most common domain for similar tasks
    const domainCounts = {}
    similar.forEach(task => {
      if (task.domain) {
        domainCounts[task.domain] = (domainCounts[task.domain] || 0) + 1
      }
    })

    const mostCommon = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])[0]

    return {
      confidence: mostCommon ? mostCommon[1] / similar.length : 0,
      patterns: similar.map(t => ({ domain: t.domain, description: t.description })),
      suggestedDomain: mostCommon ? mostCommon[0] : null
    }
  }

  /**
   * Estimate task complexity
   */
  estimateComplexity(text, domains) {
    let complexity = 'medium'

    // Complexity indicators
    const simpleIndicators = ['add', 'create', 'simple', 'basic']
    const complexIndicators = ['refactor', 'optimize', 'architecture', 'migration', 'redesign']

    const simpleCount = simpleIndicators.filter(ind => text.includes(ind)).length
    const complexCount = complexIndicators.filter(ind => text.includes(ind)).length

    if (complexCount > simpleCount) {
      complexity = 'high'
    } else if (simpleCount > 0 && complexCount === 0) {
      complexity = 'low'
    }

    // Multiple domains = more complex
    if (Object.keys(domains).length > 1) {
      complexity = 'high'
    }

    return complexity
  }

  /**
   * Select primary domain from all signals
   */
  selectPrimaryDomain(domains, semantic, historical) {
    // Priority: historical > semantic > keyword matching
    if (historical.suggestedDomain && historical.confidence > 0.7) {
      return historical.suggestedDomain
    }

    if (semantic.agents && semantic.agents.length > 0) {
      return semantic.agents[0] // Primary agent for multi-agent tasks
    }

    // Find domain with highest score
    const sorted = Object.entries(domains)
      .sort((a, b) => b[1].score - a[1].score)

    return sorted.length > 0 ? sorted[0][0] : 'generalist'
  }

  /**
   * Calculate confidence in domain selection
   */
  calculateConfidence(domains, semantic, historical) {
    let confidence = 0.5 // Base confidence

    // Boost from keyword matches
    const primaryDomain = this.selectPrimaryDomain(domains, semantic, historical)
    if (domains[primaryDomain]) {
      confidence += domains[primaryDomain].score * 0.1
    }

    // Boost from historical patterns
    if (historical.confidence > 0) {
      confidence += historical.confidence * 0.3
    }

    // Boost from semantic understanding
    if (semantic.intent) {
      confidence += 0.1
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * Build human-readable reason
   */
  buildReason(primaryDomain, domains, semantic, historical) {
    const parts = []

    if (historical.suggestedDomain && historical.confidence > 0.7) {
      parts.push(`Historical pattern: similar tasks used ${primaryDomain}`)
    }

    if (domains[primaryDomain]) {
      parts.push(`Keywords: ${domains[primaryDomain].keywords.join(', ')}`)
    }

    if (semantic.intent) {
      parts.push(`Intent: ${semantic.intent}`)
    }

    return parts.join(' | ') || `Detected ${primaryDomain} domain`
  }

  /**
   * Get alternative domains
   */
  getAlternatives(primaryDomain, domains) {
    return Object.keys(domains)
      .filter(d => d !== primaryDomain)
      .sort((a, b) => domains[b].score - domains[a].score)
  }

  /**
   * Load task history from memory
   */
  async loadTaskHistory() {
    try {
      const memoryPath = pathManager.getFilePath(this.projectId, 'memory', 'context.jsonl')
      const content = await fs.readFile(memoryPath, 'utf-8')
      const lines = content.split('\n').filter(Boolean)

      this.taskHistory = lines
        .map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        })
        .filter(entry => entry && entry.type === 'task_start' && entry.domain)
        .slice(-100) // Last 100 tasks
    } catch {
      this.taskHistory = []
    }
  }

  /**
   * Calculate text similarity (simple Jaccard)
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter(w => words2.has(w)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }
}

module.exports = TaskAnalyzer

