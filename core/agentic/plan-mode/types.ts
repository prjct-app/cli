/**
 * Plan Mode Types
 *
 * Types for the planning system that gathers context,
 * proposes plans, and executes approved changes.
 */

import type { CommandParams } from '../../types'

/**
 * Parameters passed to planning mode.
 * Extends standard CommandParams with planning-specific options.
 */
export interface PlanParams extends CommandParams {
  /** Skip approval prompt */
  autoApprove?: boolean
  /** Verbose output during planning */
  verbose?: boolean
}

/**
 * Information gathered during the planning phase.
 */
export interface GatheredInfo {
  /** Type of information (e.g., 'file_content', 'git_status', 'analysis') */
  type: GatheredInfoType
  /** Source of the information (e.g., file path, command) */
  source: string
  /** The gathered data */
  data: string | GatheredFileData | GatheredAnalysisData
  /** When this info was gathered */
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

/**
 * A proposed plan for executing changes.
 */
export interface ProposedPlan {
  /** Brief summary of what will be done */
  summary: string
  /** Detailed approach explanation */
  approach: string
  /** Steps to execute */
  steps: PlanStepDefinition[]
  /** Potential risks */
  risks?: string[]
  /** Alternative approaches considered */
  alternatives?: string[]
  /** Estimated time to complete */
  estimatedTime?: string
  /** Files that will be modified */
  affectedFiles: string[]
}

export interface PlanStepDefinition {
  /** Step description */
  description: string
  /** Tool to use (if any) */
  tool?: string
  /** Arguments for the tool */
  args?: string[]
}

/**
 * A step in the plan with execution status.
 */
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

/**
 * Plan status values.
 */
export type PlanStatus =
  | 'gathering'
  | 'analyzing'
  | 'proposing'
  | 'awaiting_approval'
  | 'executing'
  | 'completed'
  | 'aborted'

/**
 * A complete plan instance.
 */
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

/**
 * Prompt shown to user for approval.
 */
export interface ApprovalPrompt {
  title: string
  message: string
  details?: string[]
  options: ApprovalOption[]
}

export interface ApprovalOption {
  key: string
  label: string
  action: 'approve' | 'reject' | 'modify' | 'abort'
}

/**
 * Context for approval decisions.
 */
export interface ApprovalContext {
  /** Current git branch */
  branch?: string
  /** Files that will be changed */
  changedFiles: ChangedFile[]
  /** Proposed commit message */
  commitMessage?: string
  /** Files that will be deleted */
  filesToDelete: string[]
  /** Total lines of code affected */
  linesOfCode?: number
  /** Type of operation */
  operation: ApprovalOperation
  /** Warnings to show user */
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
