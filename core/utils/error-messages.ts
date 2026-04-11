/**
 * Error Messages Catalog
 *
 * Centralized error messages with context and recovery hints.
 * Types and catalog live in core/types/errors.ts.
 *
 * @see PRJ-131
 * @module utils/error-messages
 */

import type { ErrorCode, ErrorWithHint } from '../types/errors'
import { ERRORS } from '../types/errors'

/**
 * Get error with optional overrides
 */
export function getError(code: ErrorCode, overrides?: Partial<ErrorWithHint>): ErrorWithHint {
  const base = ERRORS[code]
  return { ...base, ...overrides }
}

/**
 * Create a custom error with hint
 */
export function createError(
  message: string,
  hint?: string,
  options?: { file?: string; docs?: string }
): ErrorWithHint {
  return {
    message,
    hint,
    ...options,
  }
}
