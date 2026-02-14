/**
 * Project Sync Types
 *
 * Shared types for sync-service and context-generator.
 * Single source of truth for GitData, ProjectStats, ProjectCommands, SyncAgentInfo.
 */

import type { SyncDiff } from './diff'
import type { StackDetection } from './stack'
import type { VerificationReport } from './sync-verifier'

// =============================================================================
// Git & Project Data
// =============================================================================

export interface GitData {
  branch: string
  commits: number
  contributors: number
  hasChanges: boolean
  stagedFiles: string[]
  modifiedFiles: string[]
  untrackedFiles: string[]
  recentCommits: { hash: string; message: string; date: string }[]
  weeklyCommits: number
}

export interface ProjectStats {
  fileCount: number
  version: string
  name: string
  ecosystem: string
  projectType: string
  languages: string[]
  frameworks: string[]
}

/** Project command strings (install, dev, test, etc.). Distinct from Command/CommandResult. */
export interface ProjectCommands {
  install: string
  run?: string
  test: string
  build: string
  dev: string
  lint: string
  format: string
}

/** Agent info as produced by sync/context (name, type, skill). Distinct from types/agents.AgentInfo. */
export interface SyncAgentInfo {
  name: string
  type: 'workflow' | 'domain'
  skill?: string
}

// =============================================================================
// Sync Metrics & Options
// =============================================================================

export interface SyncMetrics {
  duration: number
  originalSize: number
  filteredSize: number
  compressionRate: number
}

export interface SyncOptions {
  aiTools?: string[]
  preview?: boolean
  skipConfirmation?: boolean
  packagePath?: string
  packageName?: string
  /** Force full re-analysis, bypassing incremental cache */
  full?: boolean
  /** Pre-computed list of changed files (from watch service) */
  changedFiles?: string[]
}

export interface AIToolResult {
  toolId: string
  outputFile: string
  success: boolean
}

export interface SyncContext7Status {
  installed: boolean
  verified: boolean
  message?: string
}

export interface SyncAnalysisSummary {
  patterns: number
  antiPatterns: number
  criticalAntiPatterns: number
}

// =============================================================================
// Sync Result & Context Generator Config
// =============================================================================

export interface IncrementalInfo {
  /** Whether this was an incremental sync (vs full) */
  isIncremental: boolean
  /** Number of files that changed */
  filesChanged: number
  /** Number of files unchanged (skipped) */
  filesUnchanged: number
  /** Whether indexes were rebuilt */
  indexesRebuilt: boolean
  /** Whether agents were regenerated */
  agentsRegenerated: boolean
  /** Domains affected by changes */
  affectedDomains: string[]
}

export interface ProjectSyncResult {
  success: boolean
  projectId: string
  cliVersion: string
  git: GitData
  stats: ProjectStats
  commands: ProjectCommands
  stack: StackDetection
  agents: SyncAgentInfo[]
  skills: { agent: string; skill: string }[]
  skillsInstalled: { name: string; agent: string; status: 'installed' | 'skipped' | 'error' }[]
  contextFiles: string[]
  aiTools: AIToolResult[]
  context7?: SyncContext7Status
  analysisSummary?: SyncAnalysisSummary
  syncMetrics?: SyncMetrics
  verification?: VerificationReport
  incremental?: IncrementalInfo
  error?: string
  isPreview?: boolean
  previewDiff?: SyncDiff
}

export interface ContextGeneratorConfig {
  projectId: string
  projectPath: string
  globalPath: string
}
