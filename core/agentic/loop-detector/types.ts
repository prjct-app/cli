/**
 * Loop Detector Types
 */

export interface ErrorEntry {
  message: string
  timestamp: number
}

export interface AttemptRecord {
  command: string
  context: string
  attempts: number
  errors: ErrorEntry[]
  firstAttempt: number
  lastAttempt: number
  success: boolean
}

export interface ErrorPattern {
  type: string
  description: string
}

export interface EscalationInfo {
  status: string
  command: string
  context: string
  attempts: number
  duration: number
  errorPattern: ErrorPattern
  message: string
  suggestion: string
  lastError: string | null
}

export interface AttemptResult {
  success?: boolean
  error?: string
}

export interface AttemptInfo {
  attemptNumber: number
  isLooping: boolean
  shouldEscalate: boolean
}

export interface HallucinationPattern {
  pattern: RegExp
  type: string
  description: string
}

export interface HallucinationResult {
  detected: boolean
  type?: string
  pattern?: string
  description?: string
  message?: string
  suggestion?: string
}

export interface OutputAnalysis extends HallucinationResult {
  shouldBlock: boolean
  action?: string
}
