/**
 * Type definitions for Commands module
 *
 * Re-exports common types from core/types and defines command-specific types.
 */

// Re-export commonly used types from core/types
export type {
  ContextPaths as Paths,
  ProjectContext as Context,
  CommandParams,
  CommandResult as BaseCommandResult,
} from '../types'

/**
 * Command execution result with optional extra data.
 * Extends BaseCommandResult with command-specific fields.
 */
export interface CommandResult {
  success: boolean
  message?: string
  error?: string
  /** Duration of command execution */
  duration?: string
  /** Task that was affected */
  task?: string
  /** Feature that was affected */
  feature?: string
  /** Files that were modified */
  filesModified?: string[]
}

// Agent types
export interface AgentInfo {
  isSupported: boolean
  type: string
}

export interface Author {
  name: string | null
  email: string | null
  github?: string | null
}

export interface AgentAssignmentResult {
  agent: { name: string; domain?: string } | null
  routing: {
    confidence: number
    reason: string
    availableAgents?: string[]
  }
  _agenticNote?: string
}

// Analysis types
export interface ComplexityResult {
  level: 'low' | 'medium' | 'high'
  hours: number
  type: string
}

export interface HealthResult {
  score: number
  message: string
}

/**
 * Options for the design command.
 */
export interface DesignOptions {
  /** Type of design (e.g., 'system', 'component', 'api') */
  type?: 'system' | 'component' | 'api' | 'database'
  /** Output format */
  format?: 'markdown' | 'mermaid'
}

/**
 * Options for the cleanup command.
 */
export interface CleanupOptions {
  /** Clean up memory/history */
  memory?: boolean
  /** Type of cleanup */
  type?: 'all' | 'memory' | 'sessions' | 'cache'
  /** Dry run without making changes */
  dryRun?: boolean
}

/**
 * Options for the setup command.
 */
export interface SetupOptions {
  /** Force re-setup even if already configured */
  force?: boolean
  /** Skip interactive prompts */
  nonInteractive?: boolean
}

/**
 * Options for the migrate-all command.
 */
export interface MigrateOptions {
  /** Perform deep scan for legacy installations */
  deepScan?: boolean
  /** Remove legacy installations after migration */
  removeLegacy?: boolean
  /** Dry run without making changes */
  dryRun?: boolean
}

/**
 * Options for the analyze command.
 */
export interface AnalyzeOptions {
  /** Force re-analysis even if cached */
  force?: boolean
  /** Analysis depth */
  depth?: 'quick' | 'normal' | 'deep'
}

/**
 * Result from project migration.
 */
export interface MigrationResult {
  success: boolean
  projectId: string | null
  filesCopied?: number
  layerCounts: LayerCounts
  config: MigrationConfig | null
  author: Author | null
  issues: string[]
  dryRun: boolean
  legacyRemoved?: boolean
  legacyCleaned?: boolean
}

export interface LayerCounts {
  core: number
  progress: number
  planning: number
  analysis: number
  memory: number
  other: number
}

export interface MigrationConfig {
  projectId: string
  version: string
  migratedAt: string
}

// Type-safe command method names (for dynamic invocation)
export type CommandMethodName =
  | 'now' | 'done' | 'next' | 'build'
  | 'init' | 'feature' | 'bug' | 'architect'
  | 'ship'
  | 'context' | 'recap' | 'stuck' | 'progress' | 'roadmap' | 'status'
  | 'cleanup' | 'design'
  | 'analyze' | 'sync'
  | 'start' | 'setup' | 'migrateAll'

// Function signature for standard command methods
export type StandardCommandFn = (param: string | null, projectPath?: string) => Promise<CommandResult>

/**
 * Global configuration for prjct.
 */
export interface GlobalConfig {
  projectId: string
  projectPath?: string
  authors: AuthorEntry[]
  version: string
  created?: string
  lastSync: string
}

export interface AuthorEntry {
  name: string
  email: string
  github: string
  firstContribution?: string
  lastActivity?: string
}
