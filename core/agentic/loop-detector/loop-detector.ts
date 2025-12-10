/**
 * Loop Detector Class
 * Core loop detection and user escalation functionality
 */

import type { AttemptRecord, EscalationInfo, AttemptResult, AttemptInfo, OutputAnalysis } from './types'
import { isSimilarError, analyzeErrorPattern, generateEscalationMessage, generateSuggestion } from './error-analysis'
import { detectHallucination } from './hallucination'

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
