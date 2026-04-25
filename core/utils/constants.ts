/**
 * Constants
 * Single source of truth for tunable runtime values used across prjct-cli.
 */

import type { TimeoutKey } from '../types/utils.js'

// =============================================================================
// Timeout Constants (PRJ-111)
// =============================================================================

/**
 * Timeout values in milliseconds for various operations.
 * Can be overridden via PRJCT_TIMEOUT_* environment variables.
 */
const TIMEOUTS = {
  /** Tool availability checks (git --version, npm --version) */
  TOOL_CHECK: 5_000,

  /** Standard git operations (status, add, commit) */
  GIT_OPERATION: 10_000,

  /** Git clone with --depth 1 */
  GIT_CLONE: 60_000,

  /** HTTP fetch/API requests */
  API_REQUEST: 30_000,

  /** npm install -g (CLI installation) - 2 minutes */
  NPM_INSTALL: 120_000,

  /** User-defined workflow hooks */
  WORKFLOW_HOOK: 60_000,
} as const

/**
 * Get timeout value with optional environment variable override.
 * Environment variables: PRJCT_TIMEOUT_TOOL_CHECK, PRJCT_TIMEOUT_GIT_OPERATION, etc.
 */
export function getTimeout(key: TimeoutKey): number {
  const envVar = `PRJCT_TIMEOUT_${key}`
  const envValue = process.env[envVar]
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return TIMEOUTS[key]
}

// =============================================================================
// Output Limits (PRJ-71)
// =============================================================================

/**
 * Truncation lengths for CLI output messages.
 * Centralizes magic numbers from output.ts.
 */
export const OUTPUT_LIMITS = {
  /** Spinner message truncation */
  SPINNER_MSG: 45,
  /** Done/success message truncation */
  DONE_MSG: 50,
  /** Fail message truncation */
  FAIL_MSG: 65,
  /** Warn message truncation */
  WARN_MSG: 65,
  /** Step counter message truncation */
  STEP_MSG: 35,
  /** Progress bar text truncation */
  PROGRESS_TEXT: 25,
  /** Issue title truncation in lists */
  ISSUE_TITLE: 50,
  /** Fallback truncation when tier config is 0 */
  FALLBACK_TRUNCATE: 50,
  /** Terminal clear width */
  CLEAR_WIDTH: 80,
} as const
