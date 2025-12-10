/**
 * Error Analysis
 * Pattern detection and suggestion generation for errors
 */

import type { ErrorEntry, ErrorPattern } from './types'

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
export function generateEscalationMessage(command: string, errorPattern: ErrorPattern, maxAttempts: number): string {
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
