/**
 * Agentic Types
 *
 * Type definitions for the agentic system including:
 * - Tool registry types
 * - Agent router types
 * - Context builder types
 * - Smart context types
 * - Prompt builder types
 */

// =============================================================================
// Tool Registry Types
// =============================================================================

/**
 * Tool function signature
 */
export type ToolFunction = (...args: unknown[]) => Promise<unknown>

/**
 * Tool registry interface
 */
export interface ToolRegistryInterface {
  tools: Map<string, ToolFunction>
  register(name: string, fn: ToolFunction): void
  get(name: string): ToolFunction | undefined
  isAllowed(name: string, allowedTools: string[]): boolean
  list(): string[]
}

// =============================================================================
// Agent Router Types
// =============================================================================

/**
 * Agent information
 */
export interface Agent {
  name: string
  content: string
}

/**
 * Agent assignment context
 */
export interface AssignmentContext {
  task: string
  availableAgents: string[]
  projectPath: string
  projectId: string | null
  _template: string
}

// =============================================================================
// Context Builder Types
// =============================================================================

/**
 * Project file paths
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
 * Project context for Claude
 */
export interface ProjectContext {
  projectId: string | null
  projectPath: string
  globalPath: string
  paths: ContextPaths
  params: Record<string, unknown>
  timestamp: string
  date: string
}

/**
 * Context state key-value map
 */
export interface ContextState {
  [key: string]: string | null
}

// =============================================================================
// Smart Context Types
// =============================================================================

/**
 * Context domain for filtering
 */
export type ContextDomain = 'frontend' | 'backend' | 'devops' | 'docs' | 'testing' | 'general'

/**
 * Local interface for context state
 */
export interface SmartContextProjectState {
  projectId: string
  currentTask: { description: string; startedAt: string } | null
  queue: { description: string; priority: string }[]
}

/**
 * Full context available before filtering
 */
export interface FullContext {
  state: SmartContextProjectState | null
  agents: AgentInfo[]
  roadmap: FeatureInfo[]
  patterns: PatternInfo[]
  stack: StackInfo
  files: string[]
  projectPath: string
}

/**
 * Filtered context optimized for a task domain
 */
export interface FilteredContext {
  agents: AgentInfo[]
  roadmap: FeatureInfo[]
  patterns: PatternInfo[]
  stack: Partial<StackInfo>
  files: string[]
  metrics: FilterMetrics
}

/**
 * Agent info for context
 */
export interface AgentInfo {
  name: string
  domain: ContextDomain
  skills: string[]
  successRate?: number
}

/**
 * Feature info for context
 */
export interface FeatureInfo {
  id: string
  name: string
  relatedTo: ContextDomain[]
  status: string
}

/**
 * Pattern info for context
 */
export interface PatternInfo {
  description: string
  domain: ContextDomain
  confidence: number
}

/**
 * Stack info for context
 */
export interface StackInfo {
  frontend: string[]
  backend: string[]
  devops: string[]
  database: string[]
  testing: string[]
}

/**
 * Filtering metrics
 */
export interface FilterMetrics {
  originalSize: number
  filteredSize: number
  reductionPercent: number
  domain: ContextDomain
}

/**
 * Domain detection result
 */
export interface DomainAnalysis {
  primary: ContextDomain
  secondary: ContextDomain[]
  confidence: number
}

// =============================================================================
// Prompt Builder Types
// =============================================================================

/**
 * Unified state for prompt context
 */
export interface PromptProjectState {
  projectId: string
  currentTask: { description: string; startedAt: string; estimate?: string } | null
  queue: { description: string; priority: string }[]
}

/**
 * Template frontmatter
 */
export interface Frontmatter {
  name?: string
  description?: string
  'allowed-tools'?: string[]
  [key: string]: unknown
}

/**
 * Parsed template
 */
export interface Template {
  frontmatter: Frontmatter
  content: string
}

/**
 * Prompt builder agent info
 */
export interface PromptAgent {
  name: string
  role?: string
  skills?: string[]
  [key: string]: unknown
}

/**
 * Prompt builder context
 */
export interface PromptContext {
  files?: string[]
  filteredSize?: number
  projectPath?: string
  projectId?: string
  params?: { task?: string; description?: string }
  [key: string]: unknown
}

/**
 * Prompt builder state
 */
export interface PromptState {
  codePatterns?: string
  analysis?: string
  [key: string]: unknown
}

/**
 * Learned patterns from memory
 */
export interface LearnedPatterns {
  [key: string]: string | null
}

/**
 * Think block for reasoning
 */
export interface ThinkBlock {
  plan?: string[]
  conclusions?: string[]
  confidence?: number
}

/**
 * Memory entry
 */
export interface Memory {
  title: string
  content: string
  tags?: string[]
}

/**
 * Plan mode info
 */
export interface PlanInfo {
  isPlanning?: boolean
  requiresApproval?: boolean
  allowedTools?: string[]
}
