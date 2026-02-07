/**
 * File System & Error Types - Centralized type definitions
 *
 * Eliminates duplicate NodeError definitions across:
 * - file-helper.ts
 * - jsonl-helper.ts
 * - config-manager.ts
 * - patterns.ts, semantic-memories.ts, history.ts
 */

/**
 * Node.js error with optional code property
 * Used for ENOENT and other fs error handling
 */
export interface NodeError extends Error {
  code?: string
  errno?: number
  syscall?: string
  path?: string
}

/**
 * Type guard for NodeError
 */
export function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && 'code' in error
}

/**
 * Check if error is an ENOENT (file not found) error
 */
export function isNotFoundError(error: unknown): boolean {
  return isNodeError(error) && error.code === 'ENOENT'
}

/**
 * Check if error is a permission error
 */
export function isPermissionError(error: unknown): boolean {
  return isNodeError(error) && (error.code === 'EACCES' || error.code === 'EPERM')
}

/**
 * Check if error is a directory not empty error
 */
export function isDirNotEmptyError(error: unknown): boolean {
  return isNodeError(error) && error.code === 'ENOTEMPTY'
}

/**
 * Check if error is a file exists error
 */
export function isFileExistsError(error: unknown): boolean {
  return isNodeError(error) && error.code === 'EEXIST'
}

/**
 * Safely extract error message from unknown catch value
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}

/**
 * Safely extract error stack from unknown catch value
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack
  return undefined
}
