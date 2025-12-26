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

// Re-export types from canonical source
export type {
  Severity,
  ComplexityEstimate,
  SkillMetadata,
  Skill,
  SkillSearchResult,
  MemoryServiceEntry,
} from '../types'
