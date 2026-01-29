/**
 * BreakdownService - Feature and bug analysis
 *
 * Handles task breakdown, severity detection, and complexity estimation.
 */

import type { ComplexityEstimate, Severity } from '../types'

export class BreakdownService {
  /**
   * Break down a feature into implementation tasks
   */
  breakdownFeature(description: string): string[] {
    // Basic breakdown - could be enhanced with AI analysis
    return [
      `Analyze and plan: ${description}`,
      'Implement core functionality',
      'Test and validate',
      'Document changes',
    ]
  }

  /**
   * Detect bug severity from description
   */
  detectBugSeverity(description: string): Severity {
    const descLower = description.toLowerCase()

    // Critical indicators
    if (
      descLower.includes('crash') ||
      descLower.includes('data loss') ||
      descLower.includes('security') ||
      descLower.includes('production down')
    ) {
      return 'critical'
    }

    // High indicators
    if (
      descLower.includes('broken') ||
      descLower.includes('not working') ||
      descLower.includes('error') ||
      descLower.includes('blocking')
    ) {
      return 'high'
    }

    // Low indicators
    if (
      descLower.includes('minor') ||
      descLower.includes('cosmetic') ||
      descLower.includes('typo') ||
      descLower.includes('polish')
    ) {
      return 'low'
    }

    return 'medium'
  }

  /**
   * Estimate complexity for a task
   */
  estimateComplexity(description: string): ComplexityEstimate {
    const wordCount = description.split(/\s+/).length

    // Complex keywords
    const complexKeywords = [
      'refactor',
      'migrate',
      'redesign',
      'overhaul',
      'rewrite',
      'integration',
      'authentication',
      'authorization',
    ]

    const hasComplexKeyword = complexKeywords.some((kw) => description.toLowerCase().includes(kw))

    if (hasComplexKeyword || wordCount > 30) {
      return { level: 'high', hours: 8 }
    } else if (wordCount > 10) {
      return { level: 'medium', hours: 4 }
    } else {
      return { level: 'low', hours: 1 }
    }
  }

  /**
   * Detect task type from description
   */
  detectTaskType(description: string): 'feature' | 'bug' | 'improvement' | 'chore' {
    const descLower = description.toLowerCase()

    if (descLower.includes('bug') || descLower.includes('fix') || descLower.includes('error')) {
      return 'bug'
    }

    if (
      descLower.includes('refactor') ||
      descLower.includes('improve') ||
      descLower.includes('optimize') ||
      descLower.includes('cleanup')
    ) {
      return 'improvement'
    }

    if (
      descLower.includes('update') ||
      descLower.includes('deps') ||
      descLower.includes('config') ||
      descLower.includes('chore')
    ) {
      return 'chore'
    }

    return 'feature'
  }
}

export const breakdownService = new BreakdownService()
export default breakdownService
