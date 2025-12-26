/**
 * Utility Types
 * Common utility types and file system types.
 */

// Re-export file system types
export {
  NodeError,
  isNotFoundError,
  isPermissionError,
  isDirNotEmptyError,
  isFileExistsError,
  isNodeError,
} from './fs'

export type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>

export type MaybePromise<T> = T | Promise<T>

export interface FileInfo {
  path: string
  content: string
  mtime?: Date
  size?: number
}

export interface LogLevel {
  debug: 0
  info: 1
  warn: 2
  error: 3
}

// =============================================================================
// Date Helper Types
// =============================================================================

export interface DateComponents {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
}

// =============================================================================
// Cache Types
// =============================================================================

export interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export interface CacheOptions {
  ttl?: number
  maxSize?: number
  onEvict?: (key: string, value: unknown) => void
}

export interface CacheStats {
  hits: number
  misses: number
  size: number
  evictions: number
}

// =============================================================================
// Project Commands Types
// =============================================================================

export interface DetectedProjectCommands {
  build?: string
  test?: string
  lint?: string
  typecheck?: string
  dev?: string
  start?: string
  [key: string]: string | undefined
}
