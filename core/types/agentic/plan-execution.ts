/**
 * Plan Mode + Loop Detector + Command Executor types.
 * Split out of agentic.ts to keep each file under 500 LOC.
 */

import type { InputSource, SourcedItem } from '../agentic'
import type { CommandParams } from '../core'
import type { OrchestratorContext } from './templates-orchestration'

// Plan Mode Types

export interface PlanParams extends CommandParams {
  /** Skip approval prompt */
  autoApprove?: boolean
  /** Verbose output during planning */
  verbose?: boolean
}

export interface GatheredInfo extends SourcedItem {
  type: GatheredInfoType
  /** Path or identifier of the source */
  source: string
  data: string | GatheredFileData | GatheredAnalysisData
  gatheredAt: string
  /** Input source category for traceability */
  inputSource?: InputSource
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

// Loop Detector Types

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

// Command Executor Types

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
  agenticMode?: boolean
  agenticExecContext?: unknown
  agenticPrompt?: string
  requiresOrchestration?: boolean
  orchestratorPath?: string
  taskFragmentationPath?: string
  reasoning?: unknown
  thinkBlock?: unknown
  groundTruth?: unknown
  compressionMetrics?: unknown
  learnedPatterns?: unknown
  relevantMemories?: unknown
  orchestratorContext?: OrchestratorContext | null
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
