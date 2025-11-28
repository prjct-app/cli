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
const analyzer = require('./analyzer')
const configManager = require('../infrastructure/config-manager')
const pathManager = require('../infrastructure/path-manager')

class TaskAnalyzer {
  constructor(projectPath) {
    this.projectPath = projectPath
    this.projectId = null
    this.taskHistory = null
  }

  /**
   * Initialize analyzer with project context
   */
  async initialize() {
    this.projectId = await configManager.getProjectId(this.projectPath)
    analyzer.init(this.projectPath)
    await this.loadTaskHistory()
  }

  /**
   * Deep semantic analysis of a task
   *
   * 100% AGENTIC: No hardcoded patterns. Uses task description
   * and historical patterns only. Claude decides domain relevance.
   *
   * @param {Object} task - Task object {description, type}
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeTask(task) {
    if (!this.projectId) {
      await this.initialize()
    }

    const description = (task.description || '').toLowerCase()
    const type = (task.type || '').toLowerCase()
    const fullText = `${description} ${type}`.trim()

    // Get raw project data (no categorization)
    const projectData = {
      packageJson: await analyzer.readPackageJson(),
      extensions: await analyzer.getFileExtensions(),
      directories: await analyzer.listDirectories(),
      configFiles: await analyzer.listConfigFiles()
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
      alternatives: ['full-stack', 'generalist']
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
  detectDomains(text) {
    // No hardcoded patterns - Claude decides domain
    return {}
  }

  /**
   * Semantic analysis - understand intent
   *
   * Only detects basic intent (create, fix, improve, test).
   * Claude handles detailed domain analysis.
   */
  analyzeSemantics(text) {
    const semantic = {
      intent: null,
      requiresMultipleAgents: false
    }

    // Detect basic intent patterns (these are universal, not tech-specific)
    if (text.match(/\b(create|add|build|implement|make)\b/)) {
      semantic.intent = 'create'
    } else if (text.match(/\b(fix|repair|debug|resolve)\b/)) {
      semantic.intent = 'fix'
    } else if (text.match(/\b(improve|optimize|enhance|refactor)\b/)) {
      semantic.intent = 'improve'
    } else if (text.match(/\b(test|verify|validate)\b/)) {
      semantic.intent = 'test'
    }

    // No hardcoded multi-agent detection
    // Claude decides if multiple agents are needed based on context

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
   * Estimate task complexity based on intent words
   */
  estimateComplexity(text) {
    // Simple complexity indicators (universal, not tech-specific)
    const simpleIndicators = ['add', 'create', 'simple', 'basic', 'small']
    const complexIndicators = ['refactor', 'optimize', 'architecture', 'migration', 'redesign', 'overhaul']

    const simpleCount = simpleIndicators.filter(ind => text.includes(ind)).length
    const complexCount = complexIndicators.filter(ind => text.includes(ind)).length

    if (complexCount > simpleCount) {
      return 'high'
    } else if (simpleCount > 0 && complexCount === 0) {
      return 'low'
    }

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
  selectPrimaryDomain(semantic, historical) {
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
  calculateConfidence(semantic, historical) {
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
  buildReason(primaryDomain, semantic, historical) {
    const parts = []

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

