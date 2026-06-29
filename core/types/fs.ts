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
 * Check if error is a read-only filesystem / read-only DB error. Covers the
 * POSIX `EROFS`, the SQLite `SQLITE_READONLY` code, and the driver message
 * variants ("attempt to write a readonly database") that surface when a
 * sandboxed agent (e.g. OpenAI Codex) runs prjct against a read-only home.
 */
export function isReadonlyError(error: unknown): boolean {
  const code = isNodeError(error) ? error.code : undefined
  if (code === 'EROFS' || code === 'SQLITE_READONLY') return true
  return /readonly|read-only/i.test(getErrorMessage(error))
}

/**
 * Turn a raw fs/SQLite write failure into one actionable line. Read-only homes
 * and permission denials are the common sandbox causes and the native message
 * ("EPERM", "attempt to write a readonly database") gives the user nothing to
 * act on. Non-permission errors are reported verbatim. `subject` lets callers
 * name what failed to open/write (e.g. "database", "config").
 */
export function describeFsWriteError(error: unknown, targetPath: string, subject = 'file'): string {
  const raw = getErrorMessage(error)
  if (isReadonlyError(error) || isPermissionError(error)) {
    const code = (isNodeError(error) && error.code) || 'read-only'
    return `prjct can't write its ${subject} at ${targetPath} (${code}). This usually means a sandboxed or read-only environment. Re-run with write access to that path — some agents (e.g. Codex) run commands in a restricted sandbox, so approve filesystem/write access for prjct.`
  }
  return `Failed to write ${subject} at ${targetPath}: ${raw}`
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
