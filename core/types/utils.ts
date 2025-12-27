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
}

// =============================================================================
// Cache Types
// =============================================================================

export interface CacheEntry<T> {
  data: T
  timestamp: number
}

export interface CacheOptions {
  /** TTL in milliseconds (default: 5000) */
  ttl?: number
  /** Max entries before eviction (default: 50) */
  maxSize?: number
}

export interface CacheStats {
  size: number
  maxSize: number
  ttl: number
}

// =============================================================================
// Project Commands Types
// =============================================================================

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'
type DetectedStack = 'js' | 'python' | 'go' | 'rust' | 'dotnet' | 'java' | 'unknown'

interface DetectedCommand {
  command: string
  tool: string
}

export interface DetectedProjectCommands {
  stack: DetectedStack
  packageManager?: PackageManager
  lint?: DetectedCommand
  typecheck?: DetectedCommand
  test?: DetectedCommand
}

// =============================================================================
// Runtime Types
// =============================================================================

export type Runtime = 'bun' | 'node'
