/**
 * Services Layer
 *
 * Exports all service modules for use across the application.
 * Services encapsulate business logic extracted from CommandBase.
 */

// Re-export types from canonical source
export type {
  ComplexityEstimate,
  MemoryServiceEntry,
  Severity,
  Skill,
  SkillMetadata,
  SkillSearchResult,
} from '../types'
export type { AgentInfo, ProjectStats } from './agent-generator'
// Agent Generator - Extracted from sync-service (PRJ-87)
export { AgentGenerator, createAgentGenerator } from './agent-generator'
export { AgentService, agentService } from './agent-service'
export { BreakdownService, breakdownService } from './breakdown-service'
export type { ContextSelectionOptions, SelectedContext } from './context-selector'
// Context Selector - Task-based context selection (PRJ-85)
export { ContextSelector, contextSelector } from './context-selector'
export type { CategorizationOptions, CategorizationResult } from './file-categorizer'
// File Categorizer - Smart Context Selection (PRJ-85)
export { FileCategorizer, fileCategorizer } from './file-categorizer'
export type { FileScore, FileStats, ScoringContext } from './file-scorer'
// File Scorer
export { FileScorer, fileScorer } from './file-scorer'
export type { GitData } from './git-analyzer'
// Git Analyzer - Extracted from sync-service (PRJ-85)
export { GitAnalyzer, getEmptyGitData, gitAnalyzer } from './git-analyzer'
export { MemoryService, memoryService } from './memory-service'
export type { IndexOptions, RelevantContext, ScanResult } from './project-index'
// Project Index - Persistent scanning with scoring
export { createProjectIndexer, ProjectIndexer, RELEVANCE_THRESHOLD } from './project-index'
export { ProjectService, projectService } from './project-service'
export type { SyncResult } from './sync-service'
export { SyncService, syncService } from './sync-service'
