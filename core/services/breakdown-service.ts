/**
 * BreakdownService - Feature and bug analysis
 *
 * Returns sensible defaults. Actual classification is left to the LLM
 * which has full context and does a better job than keyword heuristics.
 */

import type { ComplexityEstimate, Severity } from '../types/services'

class BreakdownService {
  /**
   * Break down a feature into implementation tasks
   */
  breakdownFeature(_description: string): string[] {
    return []
  }

  /**
   * Detect bug severity from description
   */
  detectBugSeverity(_description: string): Severity {
    return 'medium'
  }

  /**
   * Estimate complexity for a task
   */
  estimateComplexity(_description: string): ComplexityEstimate {
    return { level: 'medium', hours: 4 }
  }

  /**
   * Detect task type from description
   */
  detectTaskType(_description: string): 'feature' | 'bug' | 'improvement' | 'chore' {
    return 'feature'
  }
}

export const breakdownService = new BreakdownService()
