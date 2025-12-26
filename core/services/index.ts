/**
 * Services Layer
 *
 * Exports all service modules for use across the application.
 * Services encapsulate business logic extracted from CommandBase.
 */

export { agentService, AgentService } from './agent-service'
export { projectService, ProjectService } from './project-service'
export { memoryService, MemoryService, type MemoryEntry } from './memory-service'
export { breakdownService, BreakdownService, type Severity, type ComplexityEstimate } from './breakdown-service'
