/**
 * Loop Detector
 * Detects and prevents execution loops and hallucinations.
 *
 * OPTIMIZATION (P2.4): Loop Detection
 * - Track attempt counts per command/error type
 * - Auto-escalate after 3 failed attempts
 * - Provide specific help based on error patterns
 *
 * ANTI-HALLUCINATION: Detects contradictory/impossible outputs
 * - Patterns that indicate Claude is hallucinating (saying file exists when it doesn't)
 * - Contradictory statements in same response
 * - Completing tasks that were never started
 *
 * Source: Augment Code pattern
 * "If you notice yourself going around in circles... ask the user for help"
 */

import type {
  AttemptInfo,
  AttemptRecord,
  AttemptResult,
  ErrorEntry,
  ErrorPattern,
  EscalationInfo,
  HallucinationPattern,
  HallucinationResult,
  OutputAnalysis,
} from '../types'

// =============================================================================
// Constants
// =============================================================================

/**
 * ANTI-HALLUCINATION: Patterns that indicate Claude may be hallucinating
 * These patterns detect contradictory or impossible statements
 */
export const HALLUCINATION_PATTERNS: HallucinationPattern[] = [
  // Contradictory file operations
  {
    pattern: /file.*not found.*created/i,
    type: 'contradiction',
    description: 'Claims file created but also not found',
  },
  {
    pattern: /created.*but.*error/i,
    type: 'contradiction',
    description: 'Claims success but also error',
  },
  {
    pattern: /successfully.*failed/i,
    type: 'contradiction',
    description: 'Contradictory success/failure',
  },

  // Impossible task states
  {
    pattern: /already.*completed.*completing/i,
    type: 'state',
    description: 'Completing already-completed task',
  },
  {
    pattern: /no task.*marking complete/i,
    type: 'state',
    description: 'Completing non-existent task',
  },
  {
    pattern: /no.*active.*done with/i,
    type: 'state',
    description: 'Finishing task that doesnt exist',
  },

  // Invented data
  {
    pattern: /version.*updated.*no package/i,
    type: 'invented',
    description: 'Version update without package.json',
  },
  {
    pattern: /committed.*nothing to commit/i,
    type: 'invented',
    description: 'Commit without changes',
  },
  { pattern: /pushed.*no remote/i, type: 'invented', description: 'Push without remote' },
]

// =============================================================================
// Hallucination Detection
// =============================================================================

/**
 * Get suggestion for handling detected hallucination
 */
export function getHallucinationSuggestion(type: string): string {
  const suggestions: Record<string, string> = {
    contradiction:
      'Verify file/resource state before reporting. Use Read tool to check actual state.',
    state: 'Check current task state from now.md before assuming completion.',
    invented: 'Verify prerequisites exist (package.json, git remote) before claiming actions.',
  }
  return suggestions[type] || 'Verify actual state before proceeding.'
}

/**
 * Detect potential hallucination patterns in output
 */
export function detectHallucination(output: string): HallucinationResult {
  if (!output || typeof output !== 'string') {
    return { detected: false }
  }

  for (const { pattern, type, description } of HALLUCINATION_PATTERNS) {
    if (pattern.test(output)) {
      return {
        detected: true,
        type,
        pattern: pattern.source,
        description,
        message: `Potential hallucination detected: ${description}`,
        suggestion: getHallucinationSuggestion(type),
      }
    }
  }

  return { detected: false }
}

// =============================================================================
// Error Analysis
// =============================================================================

/**
 * Check if two errors are similar
 */
export function isSimilarError(error1: string, error2: string): boolean {
  if (!error1 || !error2) return false

  // Normalize errors
  const normalize = (e: string) =>
    e
      .toLowerCase()
      .replace(/[0-9]+/g, 'N') // Replace numbers
      .replace(/['"`]/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()

  return normalize(error1) === normalize(error2)
}

/**
 * Analyze error pattern from history
 */
export function analyzeErrorPattern(errors: ErrorEntry[]): ErrorPattern {
  if (!errors || errors.length === 0) {
    return { type: 'unknown', description: 'No error information' }
  }

  const lastError = errors[errors.length - 1]?.message?.toLowerCase() || ''

  // Detect common patterns (ORDER MATTERS - more specific patterns first)
  if (lastError.includes('permission') || lastError.includes('access denied')) {
    return { type: 'permission', description: 'File or directory permission issue' }
  }
  if (lastError.includes('not found') || lastError.includes('no such file')) {
    return { type: 'not_found', description: 'File or resource not found' }
  }
  if (lastError.includes('syntax') || lastError.includes('parse')) {
    return { type: 'syntax', description: 'Syntax or parsing error' }
  }
  if (lastError.includes('timeout') || lastError.includes('timed out')) {
    return { type: 'timeout', description: 'Operation timed out' }
  }
  if (lastError.includes('network') || lastError.includes('connection')) {
    return { type: 'network', description: 'Network or connection issue' }
  }
  // Config pattern MUST be checked before validation (since "invalid config" contains both)
  if (lastError.includes('config') || lastError.includes('configuration')) {
    return { type: 'config', description: 'Configuration issue' }
  }
  if (lastError.includes('validation') || lastError.includes('invalid')) {
    return { type: 'validation', description: 'Validation failed' }
  }

  return { type: 'unknown', description: 'Unrecognized error pattern' }
}

/**
 * Generate user-friendly escalation message
 */
export function generateEscalationMessage(
  command: string,
  errorPattern: ErrorPattern,
  maxAttempts: number
): string {
  const messages: Record<string, string> = {
    permission: `I've tried ${command} ${maxAttempts} times but keep hitting permission issues.`,
    not_found: `After ${maxAttempts} attempts, I still can't find the required file or resource.`,
    syntax: `I'm encountering repeated syntax errors with ${command}.`,
    timeout: `The operation keeps timing out after ${maxAttempts} attempts.`,
    network: `Network issues are preventing ${command} from completing.`,
    validation: `Validation keeps failing for ${command}.`,
    config: `There seems to be a configuration issue affecting ${command}.`,
    unknown: `I've tried ${command} ${maxAttempts} times without success.`,
  }

  return messages[errorPattern.type] || messages.unknown
}

/**
 * Generate actionable suggestion based on error pattern
 */
export function generateSuggestion(errorPattern: ErrorPattern): string {
  const suggestions: Record<string, string> = {
    permission: 'Check file permissions. Try: chmod -R u+w ~/.prjct-cli/',
    not_found: 'Verify the file path exists. Run /p:init if project not initialized.',
    syntax: 'Check the file format. There may be invalid JSON or markdown.',
    timeout: 'Check your network connection or try again in a moment.',
    network: 'Verify internet connection and try again.',
    validation: 'Review the input parameters and try with different values.',
    config: 'Check .prjct/prjct.config.json for issues. Try /p:init to reinitialize.',
    unknown: 'Can you check the issue manually and provide more context?',
  }

  return suggestions[errorPattern.type] || suggestions.unknown
}

// =============================================================================
// Loop Detector Class
// =============================================================================

export class LoopDetector {
  private _attempts: Map<string, AttemptRecord>
  private _errorPatterns: Map<string, unknown>
  maxAttempts: number
  sessionTimeout: number

  constructor() {
    // Track attempts per command session
    this._attempts = new Map()

    // Track error patterns
    this._errorPatterns = new Map()

    // Configuration
    this.maxAttempts = 3
    this.sessionTimeout = 5 * 60 * 1000 // 5 minutes
  }

  /**
   * Generate a unique key for tracking attempts
   */
  private _getKey(command: string, context: string = ''): string {
    return `${command}:${context}`.toLowerCase()
  }

  /**
   * Record an attempt for a command
   */
  recordAttempt(command: string, context: string = '', result: AttemptResult = {}): AttemptInfo {
    const key = this._getKey(command, context)
    const now = Date.now()

    // Get or create attempt record
    let record = this._attempts.get(key)

    if (!record || now - record.lastAttempt > this.sessionTimeout) {
      // New session or timed out
      record = {
        command,
        context,
        attempts: 0,
        errors: [],
        firstAttempt: now,
        lastAttempt: now,
        success: false,
      }
    }

    // Update record
    record.attempts++
    record.lastAttempt = now
    record.success = result.success || false

    if (result.error) {
      record.errors.push({
        message: result.error,
        timestamp: now,
      })
    }

    this._attempts.set(key, record)

    return {
      attemptNumber: record.attempts,
      isLooping: this.isLooping(command, context),
      shouldEscalate: this.shouldEscalate(command, context),
    }
  }

  /**
   * Check if a command is in a loop (repeated failures)
   */
  isLooping(command: string, context: string = ''): boolean {
    const key = this._getKey(command, context)
    const record = this._attempts.get(key)

    if (!record) return false

    // Check if multiple failures with same error
    if (record.attempts >= 2 && !record.success) {
      const recentErrors = record.errors.slice(-3)
      if (recentErrors.length >= 2) {
        // Check if errors are similar
        const firstError = recentErrors[0]?.message || ''
        const sameError = recentErrors.every((e) => isSimilarError(e.message, firstError))
        return sameError
      }
    }

    return false
  }

  /**
   * Check if we should escalate to user
   */
  shouldEscalate(command: string, context: string = ''): boolean {
    const key = this._getKey(command, context)
    const record = this._attempts.get(key)

    if (!record) return false

    // Escalate after max attempts without success
    return record.attempts >= this.maxAttempts && !record.success
  }

  /**
   * Get escalation message for user
   */
  getEscalationInfo(command: string, context: string = ''): EscalationInfo | null {
    const key = this._getKey(command, context)
    const record = this._attempts.get(key)

    if (!record) {
      return null
    }

    // Analyze error pattern
    const errorPattern = analyzeErrorPattern(record.errors)

    return {
      status: 'BLOCKED',
      command,
      context,
      attempts: record.attempts,
      duration: record.lastAttempt - record.firstAttempt,
      errorPattern,
      message: generateEscalationMessage(command, errorPattern, this.maxAttempts),
      suggestion: generateSuggestion(errorPattern),
      lastError: record.errors[record.errors.length - 1]?.message || null,
    }
  }

  /**
   * Mark a command as successful (resets tracking)
   */
  recordSuccess(command: string, context: string = ''): void {
    const key = this._getKey(command, context)
    const record = this._attempts.get(key)

    if (record) {
      record.success = true
      record.attempts = 0
      record.errors = []
      this._attempts.set(key, record)
    }
  }

  /**
   * Clear all tracking for a command
   */
  clearTracking(command: string, context: string = ''): void {
    const key = this._getKey(command, context)
    this._attempts.delete(key)
  }

  /**
   * Clear all tracking data
   */
  clearAll(): void {
    this._attempts.clear()
    this._errorPatterns.clear()
  }

  /**
   * Get statistics for debugging
   */
  getStats(): { activeTracking: number; commands: Record<string, unknown> } {
    const stats: { activeTracking: number; commands: Record<string, unknown> } = {
      activeTracking: this._attempts.size,
      commands: {},
    }

    for (const [key, record] of this._attempts) {
      stats.commands[key] = {
        attempts: record.attempts,
        success: record.success,
        errorCount: record.errors.length,
      }
    }

    return stats
  }

  /**
   * ANTI-HALLUCINATION: Detect potential hallucination patterns in output
   */
  detectHallucination(output: string) {
    return detectHallucination(output)
  }

  /**
   * Analyze output and record if hallucination detected
   */
  analyzeOutput(command: string, output: string): OutputAnalysis {
    const hallucination = this.detectHallucination(output)

    if (hallucination.detected) {
      // Record as a special type of error
      this.recordAttempt(command, 'hallucination', {
        success: false,
        error: `HALLUCINATION: ${hallucination.description}`,
      })

      return {
        ...hallucination,
        shouldBlock: true,
        action: 'VERIFY_STATE',
      }
    }

    return { detected: false, shouldBlock: false }
  }
}

// =============================================================================
// Default Export
// =============================================================================

const loopDetector = new LoopDetector()
export default loopDetector
