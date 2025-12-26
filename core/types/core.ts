/**
 * Core Types
 * Canonical definitions for project context and state.
 */

export interface ContextPaths {
  now: string
  next: string
  context: string
  shipped: string
  metrics: string
  ideas: string
  roadmap: string
  specs: string
  memory: string
  patterns: string
  analysis: string
  codePatterns: string
}

/**
 * Command parameters passed from CLI to commands.
 * Each property corresponds to a CLI argument or flag.
 */
export interface CommandParams {
  /** Task description for now/build commands */
  task?: string
  /** Feature/bug description */
  description?: string
  /** Feature name for feature/ship commands */
  feature?: string
  /** Idea text for idea command */
  idea?: string
  /** Alias for idea */
  text?: string
  /** Name parameter for various commands */
  name?: string
  /** Skip planning mode check */
  skipPlanning?: boolean
  /** User has approved destructive action */
  approved?: boolean
  /** Period for progress command */
  period?: 'day' | 'week' | 'month'
  /** Target for design command */
  target?: string
  /** Action for architect command */
  action?: string
}

/**
 * Project context for Claude and command execution.
 */
export interface ProjectContext {
  projectId: string
  projectPath: string
  globalPath: string
  paths: ContextPaths
  params: CommandParams
  timestamp: string
  date: string
}

export interface ProjectState {
  now: string | null
  next: string | null
  shipped: string | null
  metrics: string | null
  ideas: string | null
  roadmap: string | null
  analysis: string | null
  codePatterns: string | null
  _compressed?: Record<string, CompressedContent>
  _compressionMetrics?: CompressionMetrics
}

/**
 * Metrics from semantic compression of project state.
 */
export interface CompressionMetrics {
  /** Original total size in bytes */
  originalSize: number
  /** Compressed total size in bytes */
  compressedSize: number
  /** Compression ratio (0-1) */
  ratio: number
  /** Fields that were compressed */
  fieldsCompressed: string[]
  /** Timestamp of compression */
  timestamp: string
}

export interface CompressedContent {
  raw: string
  summary: string
  compressed: string
}
