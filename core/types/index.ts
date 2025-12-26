/**
 * Core Types for prjct-cli
 * Shared type definitions across the codebase
 */

// ============================================
// File System Types (centralized)
// ============================================
export {
  NodeError,
  isNotFoundError,
  isPermissionError,
  isDirNotEmptyError,
  isFileExistsError,
  isNodeError,
} from './fs'

// ============================================
// Command System
// ============================================

export interface CommandResult {
  success: boolean
  message?: string
  error?: string
  data?: unknown
}

export interface CommandUsage {
  human: string
  claude: string
}

export interface CommandMetadata {
  requiresProject: boolean
  requiresActiveTask: boolean
  modifiesState: boolean
  category: string
}

export interface CommandFeature {
  name: string
  status: 'implemented' | 'planned' | 'deprecated'
}

export interface Command {
  name: string
  description: string
  category: string
  usage: CommandUsage
  metadata: CommandMetadata
  features: CommandFeature[]
  implemented: boolean
}

export interface CommandRegistry {
  getByName(name: string): Command | undefined
  getByCategory(category: string): Command[]
  getAll(): Command[]
  getStats(): CommandStats
}

export interface CommandStats {
  total: number
  implemented: number
  planned: number
  byCategory: Record<string, number>
}

// ============================================
// Context System
// ============================================

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

// ============================================
// Agent System
// ============================================

export interface Agent {
  name: string
  content: string
  path: string
  role: string | null
  domain: string | null
  skills: string[]
  modified: Date
}

export interface AgentInfo {
  name: string
  type: string
  domain?: string
}

export interface AgentRouting {
  agent: AgentInfo
  confidence: number
  reason: string
  availableAgents: string[]
}

// ============================================
// Tool System
// ============================================

export type ToolFunction = (...args: unknown[]) => Promise<unknown>

export interface ToolDefinition {
  name: string
  description: string
  handler: ToolFunction
  parallelizable: boolean
}

export interface ToolRegistry {
  get(name: string): ToolFunction | undefined
  list(): string[]
  has(name: string): boolean
}

export interface BashResult {
  stdout: string
  stderr: string
  code: number
}

// ============================================
// Execution System
// ============================================

/**
 * Result of command execution through the agentic system.
 *
 * @group Core - Essential execution data
 * @group Context - Execution environment
 * @group Agentic - AI-related outputs
 */
export interface ExecutionResult {
  // Core
  /** Whether command executed successfully */
  success: boolean
  /** Generated prompt sent to Claude */
  prompt: string
  /** Whether execution was delegated to agentic system */
  agenticDelegation: boolean

  // Context
  /** Template that was loaded */
  template: Template | null
  /** Project context used */
  context: ProjectContext
  /** Project state at execution time */
  state: ProjectState

  // Agentic outputs
  /** Chain-of-thought reasoning (if enabled) */
  reasoning: ChainOfThoughtResult | null
  /** Think block content (if enabled) */
  thinkBlock: ThinkBlockResult | null
  /** Ground truth verification result */
  groundTruth: GroundTruthResult | null
  /** Compression metrics from semantic compression */
  compressionMetrics: CompressionMetrics | null
  /** Patterns learned during execution */
  learnedPatterns: LearnedPatterns | null
  /** Memories relevant to this execution */
  relevantMemories: Memory[]
}

/**
 * Result from chain-of-thought processing.
 */
export interface ChainOfThoughtResult {
  steps: string[]
  conclusion: string
}

/**
 * Result from think block processing.
 */
export interface ThinkBlockResult {
  content: string
  duration: number
}

/**
 * Result from ground truth verification.
 */
export interface GroundTruthResult {
  verified: boolean
  checks: GroundTruthCheck[]
}

export interface GroundTruthCheck {
  name: string
  passed: boolean
  message?: string
}

/**
 * Patterns learned during execution.
 */
export interface LearnedPatterns {
  /** Code patterns detected */
  code: string[]
  /** User preference patterns */
  preferences: string[]
  /** Error patterns to avoid */
  errors: string[]
}

export interface ValidationResult {
  valid: boolean
  error: string | null
  suggestion: string | null
  state: ProjectState
}

// ============================================
// Memory System
// ============================================

export interface Memory {
  id: string
  type: string
  content: string
  tags: string[]
  timestamp: string
  metadata?: MemoryMetadata
}

/**
 * Metadata associated with a memory entry.
 */
export interface MemoryMetadata {
  /** Command that created this memory */
  command?: string
  /** Confidence score (0-1) */
  confidence?: number
  /** Related task ID */
  taskId?: string
  /** Related feature name */
  feature?: string
  /** Source of the memory */
  source?: 'user' | 'system' | 'learned'
}

export interface MemoryQuery {
  type?: string
  tags?: string[]
  limit?: number
  since?: string
}

export type MemoryTag =
  | 'decision'
  | 'pattern'
  | 'preference'
  | 'learning'
  | 'error'
  | 'success'

// ============================================
// Session System
// ============================================

export interface Session {
  id: string
  startedAt: string
  endedAt?: string
  task?: string
  duration?: number
  metrics?: SessionMetrics
}

export interface SessionMetrics {
  filesCreated: number
  filesModified: number
  linesAdded: number
  linesRemoved: number
  commits: number
}

// ============================================
// Task System
// ============================================

export interface Task {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  createdAt: string
  completedAt?: string
  duration?: string
  metadata?: TaskMetadata
}

export interface TaskMetadata {
  domain?: string
  complexity?: 'low' | 'medium' | 'high'
  agent?: string
  tags?: string[]
}

/**
 * Result of analyzing a task to determine routing and complexity.
 */
export interface TaskAnalysis {
  /** Primary domain detected (e.g., 'frontend', 'backend', 'devops') */
  primaryDomain: string
  /** Confidence score (0-1) */
  confidence: number
  /** Semantic analysis of task description */
  semantic: SemanticAnalysis
  /** Historical analysis from past similar tasks */
  historical: HistoricalAnalysis
  /** Complexity level */
  complexity: 'low' | 'medium' | 'high'
  /** Project-specific data used in analysis */
  projectData: ProjectAnalysisData
  /** Keywords that matched domain patterns */
  matchedKeywords: string[]
  /** Human-readable reason for domain assignment */
  reason: string
  /** Alternative domains considered */
  alternatives: string[]
}

export interface SemanticAnalysis {
  /** Detected intent */
  intent: string
  /** Key entities in the task */
  entities: string[]
  /** Sentiment score */
  sentiment: number
}

export interface HistoricalAnalysis {
  /** Similar past tasks count */
  similarTasksCount: number
  /** Average duration of similar tasks */
  avgDuration: string | null
  /** Success rate of similar tasks */
  successRate: number
}

export interface ProjectAnalysisData {
  /** Available agents */
  availableAgents: string[]
  /** Stack technologies */
  stack: string[]
  /** Recent activity domains */
  recentDomains: string[]
}

// ============================================
// Config System
// ============================================

export interface ProjectConfig {
  projectId: string
  name?: string
  createdAt: string
  updatedAt: string
  settings?: ProjectSettings
}

export interface ProjectSettings {
  autoCommit?: boolean
  commitFooter?: string
  branchNaming?: string
}

export interface GlobalConfig {
  version: string
  projects: Record<string, ProjectConfig>
  settings: GlobalSettings
}

export interface GlobalSettings {
  defaultAuthor?: string
  theme?: 'light' | 'dark'
  telemetry?: boolean
}

// ============================================
// Template System
// ============================================

export interface Template {
  name: string
  content: string
  frontmatter: TemplateFrontmatter
}

export interface TemplateFrontmatter {
  name: string
  description?: string
  category?: string
  allowedTools?: string[]
  validation?: ValidationRule[]
}

export interface ValidationRule {
  type: string
  field?: string
  message?: string
}

// ============================================
// Utility Types
// ============================================

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
