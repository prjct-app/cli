/**
 * File System Types - Centralized FS-related type definitions
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
 * Check if error is an ENOENT (file not found) error
 */
export function isNotFoundError(error: unknown): boolean {
  return (error as NodeError)?.code === 'ENOENT'
}

/**
 * Check if error is a permission error
 */
export function isPermissionError(error: unknown): boolean {
  const code = (error as NodeError)?.code
  return code === 'EACCES' || code === 'EPERM'
}

/**
 * Check if error is a directory not empty error
 */
export function isDirNotEmptyError(error: unknown): boolean {
  return (error as NodeError)?.code === 'ENOTEMPTY'
}

/**
 * Check if error is a file exists error
 */
export function isFileExistsError(error: unknown): boolean {
  return (error as NodeError)?.code === 'EEXIST'
}

/**
 * Type guard for NodeError
 */
export function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && 'code' in error
}
