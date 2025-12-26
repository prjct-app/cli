/**
 * Agentic Types
 * Types for the agentic system.
 */

import type { CommandParams } from './core'

// =============================================================================
// Tool Registry Types
// =============================================================================

export type ToolFunction = (...args: unknown[]) => Promise<unknown>

export interface ToolRegistryInterface {
  tools: Map<string, ToolFunction>
  register(name: string, fn: ToolFunction): void
  get(name: string): ToolFunction | undefined
  isAllowed(name: string, allowedTools: string[]): boolean
  list(): string[]
}

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

// =============================================================================
// Context Types
// =============================================================================

export type ContextDomain = 'frontend' | 'backend' | 'devops' | 'docs' | 'testing' | 'general'

export interface ContextState {
  [key: string]: string | null
}

export interface SmartContextProjectState {
  projectId: string
  currentTask: { description: string; startedAt: string } | null
  queue: { description: string; priority: string }[]
}

export interface FullContext {
  state: SmartContextProjectState | null
  agents: AgentInfo[]
  roadmap: FeatureInfo[]
  patterns: PatternInfo[]
  stack: StackInfo
  files: string[]
  projectPath: string
}

export interface FilteredContext {
  agents: AgentInfo[]
  roadmap: FeatureInfo[]
  patterns: PatternInfo[]
  stack: Partial<StackInfo>
  files: string[]
  metrics: FilterMetrics
}

export interface AgentInfo {
  name: string
  domain: ContextDomain
  skills: string[]
  successRate?: number
}

export interface FeatureInfo {
  id: string
  name: string
  relatedTo: ContextDomain[]
  status: string
}

export interface PatternInfo {
  description: string
  domain: ContextDomain
  confidence: number
}

export interface StackInfo {
  frontend: string[]
  backend: string[]
  devops: string[]
  database: string[]
  testing: string[]
}

export interface FilterMetrics {
  originalSize: number
  filteredSize: number
  reductionPercent: number
  domain: ContextDomain
}

export interface DomainAnalysis {
  primary: ContextDomain
  secondary: ContextDomain[]
  confidence: number
}

// =============================================================================
// Prompt Builder Types
// =============================================================================

export interface PromptProjectState {
  projectId: string
  currentTask: { description: string; startedAt: string; estimate?: string } | null
  queue: { description: string; priority: string }[]
}

export interface Frontmatter {
  name?: string
  description?: string
  'allowed-tools'?: string[]
  [key: string]: unknown
}

export interface Template {
  frontmatter: Frontmatter
  content: string
}

export interface PromptAgent {
  name: string
  role?: string
  skills?: string[]
  [key: string]: unknown
}

export interface PromptContext {
  files?: string[]
  filteredSize?: number
  projectPath?: string
  projectId?: string
  params?: { task?: string; description?: string }
  [key: string]: unknown
}

export interface PromptState {
  codePatterns?: string
  analysis?: string
  [key: string]: unknown
}

/**
 * Learned patterns from memory (Record version)
 */
export type LearnedPatternsRecord = Record<string, string | null>

export interface ThinkBlock {
  plan?: string[]
  conclusions?: string[]
  confidence?: number
}

export interface PlanInfo {
  isPlanning?: boolean
  requiresApproval?: boolean
  allowedTools?: string[]
  active?: Plan | null
}

// =============================================================================
// Ground Truth Types
// =============================================================================

export interface GroundTruthContext {
  projectPath: string
  projectId?: string | null
  paths: {
    now: string
    next: string
    metrics: string
    shipped: string
    roadmap: string
    specs: string
    [key: string]: string
  }
  params: {
    feature?: string
    description?: string
    task?: string
    name?: string
    [key: string]: unknown
  }
}

export interface VerificationResult {
  verified: boolean
  actual: Record<string, unknown>
  warnings: string[]
  recommendations: string[]
}

export type Verifier = (context: GroundTruthContext, state: unknown) => Promise<VerificationResult>

// =============================================================================
// Plan Mode Types
// =============================================================================

export interface PlanParams extends CommandParams {
  /** Skip approval prompt */
  autoApprove?: boolean
  /** Verbose output during planning */
  verbose?: boolean
}

export interface GatheredInfo {
  type: GatheredInfoType
  source: string
  data: string | GatheredFileData | GatheredAnalysisData
  gatheredAt: string
}

export type GatheredInfoType =
  | 'file_content'
  | 'git_status'
  | 'git_diff'
  | 'analysis'
  | 'dependencies'
  | 'structure'

export interface GatheredFileData {
  path: string
  content: string
  lines: number
}

export interface GatheredAnalysisData {
  summary: string
  findings: string[]
}

export interface ProposedPlan {
  summary: string
  approach: string
  steps: PlanStepDefinition[]
  risks?: string[]
  alternatives?: string[]
  estimatedTime?: string
  affectedFiles: string[]
}

export interface PlanStepDefinition {
  description: string
  tool?: string
  args?: string[]
}

export interface PlanStep {
  index: number
  description: string
  status: 'pending' | 'completed' | 'failed'
  tool?: string
  args?: string[]
  result?: PlanStepResult
  completedAt?: string
  error?: string
}

export interface PlanStepResult {
  success: boolean
  output?: string
  filesModified?: string[]
}

export type PlanStatus =
  | 'gathering'
  | 'analyzing'
  | 'proposing'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'aborted'

export interface Plan {
  id: string
  projectId: string
  command: string
  params: PlanParams
  status: PlanStatus
  startedAt: string
  gatheredInfo: GatheredInfo[]
  analysis: PlanAnalysis | null
  proposedPlan: ProposedPlan | null
  userFeedback: string | null
  approvedAt: string | null
  executionStartedAt: string | null
  completedAt: string | null
  steps: PlanStep[]
  currentStep: number
  abortReason?: string
}

export interface PlanAnalysis {
  complexity: 'low' | 'medium' | 'high'
  riskLevel: 'low' | 'medium' | 'high'
  estimatedDuration: string
  dependencies: string[]
}

export interface ApprovalPrompt {
  title: string
  message: string
  details?: string[]
  options: ApprovalOption[]
}

export interface ApprovalOption {
  key: string
  label: string
  action: 'approve' | 'reject' | 'modify' | 'abort' | 'edit' | 'list'
}

export interface ApprovalContext {
  branch?: string
  changedFiles: ChangedFile[]
  commitMessage?: string
  filesToDelete: string[]
  linesOfCode?: number
  operation: ApprovalOperation
  warnings: string[]
}

export interface ChangedFile {
  path: string
  action: 'create' | 'modify' | 'delete'
  linesAdded?: number
  linesRemoved?: number
}

export type ApprovalOperation =
  | 'create_files'
  | 'modify_files'
  | 'delete_files'
  | 'git_commit'
  | 'git_push'
  | 'run_command'

// =============================================================================
// Loop Detector Types
// =============================================================================

export interface ErrorEntry {
  message: string
  timestamp: number
}

export interface AttemptRecord {
  command: string
  context: string
  attempts: number
  errors: ErrorEntry[]
  firstAttempt: number
  lastAttempt: number
  success: boolean
}

export interface ErrorPattern {
  type: string
  description: string
}

export interface EscalationInfo {
  status: string
  command: string
  context: string
  attempts: number
  duration: number
  errorPattern: ErrorPattern
  message: string
  suggestion: string
  lastError: string | null
}

export interface AttemptResult {
  success?: boolean
  error?: string
}

export interface AttemptInfo {
  attemptNumber: number
  isLooping: boolean
  shouldEscalate: boolean
}

export interface HallucinationPattern {
  pattern: RegExp
  type: string
  description: string
}

export interface HallucinationResult {
  detected: boolean
  type?: string
  pattern?: string
  description?: string
  message?: string
  suggestion?: string
}

export interface OutputAnalysis extends HallucinationResult {
  shouldBlock: boolean
  action?: string
}

// =============================================================================
// Command Executor Types
// =============================================================================

export interface ExecutionResult {
  success: boolean
  error?: string
  escalation?: EscalationInfo | null
  isLoopDetected?: boolean
  suggestion?: string
  validation?: unknown
  isValidationError?: boolean
  template?: unknown
  context?: unknown
  state?: unknown
  prompt?: string
  agenticDelegation?: boolean
  agentsPath?: string
  agentRoutingPath?: string
  reasoning?: unknown
  thinkBlock?: unknown
  groundTruth?: unknown
  compressionMetrics?: unknown
  learnedPatterns?: unknown
  relevantMemories?: unknown
  formatResponse?: (data: unknown) => string
  formatThinkBlock?: (verbose: boolean) => string
  parallel?: {
    execute: (toolCalls: unknown[]) => Promise<unknown>
    readAll: (paths: string[]) => Promise<Map<string, string | null>>
    canParallelize: (tools: string[]) => boolean
    getMetrics: () => unknown
  }
  memory?: {
    create: (memory: unknown) => Promise<string>
    autoRemember: (type: string, value: string, ctx?: string) => Promise<void>
    search: (query: string) => Promise<unknown[]>
    findByTags: (tags: string[]) => Promise<unknown[]>
    getStats: () => Promise<unknown>
  }
  plan?: {
    active: unknown
    isPlanning: boolean
    isDestructive: boolean
    requiresApproval: boolean
    recordInfo: (info: unknown) => void
    setAnalysis: (analysis: unknown) => void
    propose: (plan: unknown) => unknown
    approve: (feedback?: string | null) => unknown
    reject: (reason?: string | null) => unknown
    getApprovalPrompt: () => unknown
    startExecution: () => unknown
    getNextStep: () => unknown
    completeStep: (result?: unknown) => unknown
    failStep: (error: string) => unknown
    abort: (reason?: string) => unknown
    getStatus: () => string
    getAllowedTools: () => string[]
  }
  attemptNumber?: number
  isLooping?: boolean
}

export interface SimpleExecutionResult {
  success: boolean
  result?: unknown
  error?: string
}

export type ExecutionToolsFn = (
  tools: {
    read: (path: string) => Promise<unknown>
    write: (path: string, content: string) => Promise<unknown>
    bash: (cmd: string) => Promise<unknown>
  },
  context: unknown
) => Promise<unknown>

// =============================================================================
// Template Loader Types
// =============================================================================

export interface ParsedTemplate {
  frontmatter: Frontmatter
  content: string
  raw: string
}

// =============================================================================
// Skill Loader Types
// =============================================================================

export interface FormattedSkill {
  id?: string
  name: string
  description?: string
  prompt?: string
  content?: string
}

export interface SkillContext {
  skills?: FormattedSkill[]
  availableSkills: FormattedSkill[]
  skillsMarkdown: string
  projectPath?: string
  timestamp?: string
}

// =============================================================================
// Chain of Thought Types
// =============================================================================

export interface ChainOfThoughtContext {
  projectPath?: string
  projectId?: string | null
  paths?: Record<string, string>
  params?: Record<string, unknown>
}

export interface ChainOfThoughtState {
  currentTask?: { description: string; startedAt: string } | null
  queue?: { description: string; priority: string }[]
  [key: string]: unknown
}

export interface ReasoningStep {
  step: string
  result: string
  passed: boolean
}

export interface ReasoningResult {
  steps: ReasoningStep[]
  allPassed: boolean
  plan: string[]
}

export interface ChainOfThoughtResult {
  reasoning: ReasoningResult | null
  thinkBlock: string | null
}

// =============================================================================
// Agentic Services Types
// =============================================================================

export interface AgenticServices {
  commandExecutor: unknown
  contextBuilder: unknown
  toolRegistry: unknown
  promptBuilder: unknown
  smartContext: unknown
  templateLoader: unknown
  memorySystem: unknown
  agentRouter: unknown
}

// =============================================================================
// Learned Patterns Type
// =============================================================================

export interface LearnedPatterns {
  commit_footer?: string | null
  branch_naming?: string | null
  test_before_ship?: string | null
  preferred_agent?: string | null
  [key: string]: string | null | undefined
}
