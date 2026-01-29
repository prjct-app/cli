/**
 * Services Layer
 *
 * Exports all service modules for use across the application.
 * Services encapsulate business logic extracted from CommandBase.
 */

export { agentService, AgentService } from './agent-service'
export { projectService, ProjectService } from './project-service'
export { memoryService, MemoryService } from './memory-service'
export { breakdownService, BreakdownService } from './breakdown-service'
export { syncService, SyncService } from './sync-service'
export type { SyncResult } from './sync-service'

// Git Analyzer - Extracted from sync-service (PRJ-85)
export { GitAnalyzer, gitAnalyzer, getEmptyGitData } from './git-analyzer'
export type { GitData } from './git-analyzer'

// Agent Generator - Extracted from sync-service (PRJ-87)
export { AgentGenerator, createAgentGenerator } from './agent-generator'
export type { AgentInfo, ProjectStats } from './agent-generator'

// Project Index - Persistent scanning with scoring
export { ProjectIndexer, createProjectIndexer, RELEVANCE_THRESHOLD } from './project-index'
export type { IndexOptions, ScanResult, RelevantContext } from './project-index'

// File Scorer
export { FileScorer, fileScorer } from './file-scorer'
export type { FileScore, FileStats, ScoringContext } from './file-scorer'

// File Categorizer - Smart Context Selection (PRJ-85)
export { FileCategorizer, fileCategorizer } from './file-categorizer'
export type { CategorizationResult, CategorizationOptions } from './file-categorizer'

// Context Selector - Task-based context selection (PRJ-85)
export { ContextSelector, contextSelector } from './context-selector'
export type { SelectedContext, ContextSelectionOptions } from './context-selector'

// Re-export types from canonical source
export type {
  Severity,
  ComplexityEstimate,
  SkillMetadata,
  Skill,
  SkillSearchResult,
  MemoryServiceEntry,
} from '../types'
