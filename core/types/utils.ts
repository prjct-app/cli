/**
 * Utility Types
 * Common utility types and file system types.
 */

// Re-export file system types
export {
  getErrorMessage,
  getErrorStack,
  isDirNotEmptyError,
  isFileExistsError,
  isNodeError,
  isNotFoundError,
  isPermissionError,
  NodeError,
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

// Date Helper Types

export interface DateComponents {
  year: string
  month: string
  day: string
}

// Cache Types

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

// Project Commands Types

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
  versionFile?: string
  changelogFile?: string
}

// Runtime Types

export type Runtime = 'bun' | 'node'

// MCP Config Types

export interface MCPServerConfig {
  command: string
  args: string[]
  env?: Record<string, string>
  description?: string
}

export interface ProviderMcpPath {
  provider: string
  configPath: string
  /** Gemini: write into existing settings.json; Claude: standalone mcp.json */
  mergeIntoExisting: boolean
}

// Constants Types

export type RoadmapStatusKey = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'

export type Status = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'paused'

export type Priority = 'low' | 'medium' | 'high' | 'critical'

export type PlanStatusValue =
  | 'gathering'
  | 'analyzing'
  | 'proposing'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'aborted'

export type TimeoutKey =
  | 'TOOL_CHECK'
  | 'GIT_OPERATION'
  | 'GIT_CLONE'
  | 'API_REQUEST'
  | 'NPM_INSTALL'
  | 'WORKFLOW_HOOK'

// Preserve Sections Types

export interface PreservedSection {
  id: string
  content: string
  startIndex: number
  endIndex: number
}

// Retry Types

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelayMs: number
  /** Maximum delay in milliseconds (default: 8000) */
  maxDelayMs: number
  /** Number of consecutive failures before opening circuit (default: 5) */
  circuitBreakerThreshold?: number
  /** Time in milliseconds to keep circuit open (default: 60000) */
  circuitBreakerTimeoutMs?: number
}

export interface CircuitState {
  consecutiveFailures: number
  openedAt: number | null
}

// Subtask Display Types

export type SubtaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked'

export interface SubtaskDisplay {
  id: string
  domain: string
  description: string
  status: SubtaskStatus
}
