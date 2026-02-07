/**
 * Sync Verifier Types
 * Types for sync verification checks.
 */

export interface VerificationCheck {
  name: string
  command?: string
  script?: string
  enabled?: boolean
}

export interface VerificationConfig {
  checks?: VerificationCheck[]
  failFast?: boolean
}

export interface VerificationCheckResult {
  name: string
  passed: boolean
  output?: string
  error?: string
  durationMs: number
}

export interface VerificationReport {
  passed: boolean
  checks: VerificationCheckResult[]
  totalMs: number
  failedCount: number
  passedCount: number
  skippedCount: number
}
