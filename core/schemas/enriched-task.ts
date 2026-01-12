/**
 * Enriched Task Schema
 * Defines the structure of a fully enriched task from PM Expert
 */

import { z } from 'zod'

// =============================================================================
// Enums
// =============================================================================

export const TaskTypeSchema = z.enum([
  'feature',
  'bug',
  'improvement',
  'task',
  'chore',
  'spike',
  'epic',
])

export const PrioritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'none',
])

export const ComplexitySchema = z.enum([
  'trivial',   // < 1 hour
  'small',     // 1-4 hours
  'medium',    // 1-2 days
  'large',     // 3-5 days
  'epic',      // > 1 week
])

export const RiskLevelSchema = z.enum(['none', 'low', 'medium', 'high', 'critical'])

// =============================================================================
// User Story
// =============================================================================

export const UserStorySchema = z.object({
  role: z.string().describe('The user role (e.g., "mobile user")'),
  action: z.string().describe('What the user wants to do'),
  benefit: z.string().describe('The benefit they get'),
  formatted: z.string().describe('Formatted user story: "As a [role], I want [action] so that [benefit]"'),
})

// =============================================================================
// Acceptance Criteria
// =============================================================================

export const AcceptanceCriterionSchema = z.object({
  id: z.string().describe('Unique criterion ID (e.g., AC-1)'),
  description: z.string().describe('Criterion description'),
  type: z.enum(['functional', 'technical', 'ux', 'performance']).default('functional'),
  testable: z.boolean().default(true).describe('Whether it is verifiable/testable'),
  gherkin: z.string().optional().describe('Optional Given/When/Then format'),
})

// =============================================================================
// Dependencies
// =============================================================================

export const CodeDependencySchema = z.object({
  file: z.string().describe('File path'),
  reason: z.string().describe('Why it is relevant'),
  risk: RiskLevelSchema.describe('Risk level of modifying'),
  lines: z.string().optional().describe('Specific lines (e.g., "45-67")'),
})

export const ApiDependencySchema = z.object({
  endpoint: z.string().describe('Endpoint (e.g., POST /api/auth/login)'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  status: z.enum(['stable', 'in_development', 'deprecated']).default('stable'),
  risk: RiskLevelSchema,
  notes: z.string().optional(),
})

export const TaskDependencySchema = z.object({
  id: z.string().describe('Blocking task ID'),
  title: z.string().describe('Task title'),
  status: z.string().describe('Current status'),
  blocking: z.boolean().default(false).describe('Whether it completely blocks'),
  risk: RiskLevelSchema,
})

export const DependenciesSchema = z.object({
  code: z.array(CodeDependencySchema).default([]),
  api: z.array(ApiDependencySchema).default([]),
  tasks: z.array(TaskDependencySchema).default([]),
  infrastructure: z.array(z.object({
    service: z.string(),
    purpose: z.string(),
    risk: RiskLevelSchema,
  })).default([]),
})

// =============================================================================
// Technical Analysis
// =============================================================================

export const TechnicalAnalysisSchema = z.object({
  affectedFiles: z.array(z.object({
    path: z.string(),
    changes: z.string().describe('Expected changes'),
    complexity: ComplexitySchema,
  })).default([]),

  existingPatterns: z.array(z.object({
    pattern: z.string().describe('Pattern name'),
    file: z.string().describe('Reference file'),
    relevance: z.string().describe('Why it is relevant'),
  })).default([]),

  suggestedApproach: z.string().optional().describe('Recommended approach'),

  potentialRisks: z.array(z.object({
    risk: z.string(),
    mitigation: z.string(),
    severity: RiskLevelSchema,
  })).default([]),

  testingStrategy: z.object({
    unit: z.array(z.string()).default([]),
    integration: z.array(z.string()).default([]),
    e2e: z.array(z.string()).default([]),
  }).optional(),
})

// =============================================================================
// LLM Prompt (AI-Agnostic)
// =============================================================================

/**
 * LLM Prompt Schema
 * Generates prompts compatible with any AI assistant:
 * Claude, ChatGPT, Copilot, Gemini, Cursor, etc.
 */
export const LLMPromptSchema = z.object({
  context: z.string().describe('Codebase context (stack, structure)'),
  problem: z.string().describe('What problem needs to be solved'),
  task: z.string().describe('Task description'),
  instructions: z.array(z.string()).describe('Step-by-step instructions'),
  files: z.array(z.string()).describe('Files to modify'),
  patterns: z.array(z.string()).describe('Reference patterns to follow'),
  acceptanceCriteria: z.array(z.string()).describe('How to know when done'),
  verification: z.array(z.string()).describe('How to test/verify correctness'),
  formatted: z.string().describe('Complete copy-paste ready prompt'),
})

// =============================================================================
// Main Enriched Task Schema
// =============================================================================

export const EnrichedTaskSchema = z.object({
  // Identification
  id: z.string().describe('Task UUID'),
  externalId: z.string().optional().describe('External system ID (ENG-123)'),
  provider: z.enum(['linear', 'jira', 'monday', 'github', 'internal']).optional(),

  // Basic (original input)
  originalTitle: z.string().describe('Original title from PO'),
  originalDescription: z.string().optional().describe('Original description'),

  // Classification
  type: TaskTypeSchema,
  priority: PrioritySchema,
  complexity: ComplexitySchema,
  labels: z.array(z.string()).default([]),

  // Enrichment
  userStory: UserStorySchema,
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1),
  definitionOfDone: z.array(z.string()).default([
    'Code reviewed',
    'Tests pass',
    'Documentation updated',
    'Deployed to staging',
  ]),

  // Technical analysis
  technicalAnalysis: TechnicalAnalysisSchema,
  dependencies: DependenciesSchema,

  // For the LLM
  llmPrompt: LLMPromptSchema,

  // Metadata
  enrichedAt: z.string().describe('ISO timestamp'),
  enrichedBy: z.enum(['pm-expert', 'manual', 'imported']).default('pm-expert'),
  confidence: z.number().min(0).max(1).describe('Analysis confidence (0-1)'),

  // Status
  readyForDev: z.boolean().default(false).describe('Whether ready for development'),
  blockers: z.array(z.string()).default([]).describe('Active blockers'),
})

// =============================================================================
// Types
// =============================================================================

export type TaskType = z.infer<typeof TaskTypeSchema>
export type Priority = z.infer<typeof PrioritySchema>
export type Complexity = z.infer<typeof ComplexitySchema>
export type RiskLevel = z.infer<typeof RiskLevelSchema>
export type UserStory = z.infer<typeof UserStorySchema>
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>
export type Dependencies = z.infer<typeof DependenciesSchema>
export type TechnicalAnalysis = z.infer<typeof TechnicalAnalysisSchema>
export type LLMPrompt = z.infer<typeof LLMPromptSchema>
export type EnrichedTask = z.infer<typeof EnrichedTaskSchema>

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create formatted user story
 */
export function formatUserStory(role: string, action: string, benefit: string): UserStory {
  return {
    role,
    action,
    benefit,
    formatted: `As a **${role}**, I want to **${action}** so that **${benefit}**.`,
  }
}

/**
 * Check if task is ready for development
 */
export function isReadyForDev(task: EnrichedTask): { ready: boolean; reasons: string[] } {
  const reasons: string[] = []

  // Check acceptance criteria
  if (task.acceptanceCriteria.length < 2) {
    reasons.push('Needs at least 2 acceptance criteria')
  }

  // Check blockers
  const blockingDeps = task.dependencies.tasks.filter(t => t.blocking)
  if (blockingDeps.length > 0) {
    reasons.push(`Blocked by: ${blockingDeps.map(t => t.id).join(', ')}`)
  }

  // Check critical risks
  const criticalRisks = task.technicalAnalysis.potentialRisks.filter(r => r.severity === 'critical')
  if (criticalRisks.length > 0) {
    reasons.push('Has unmitigated critical risks')
  }

  // Check analysis confidence
  if (task.confidence < 0.6) {
    reasons.push('Low confidence analysis - needs manual review')
  }

  return {
    ready: reasons.length === 0,
    reasons,
  }
}

/**
 * Estimate story points based on complexity
 */
export function estimateStoryPoints(complexity: Complexity): number {
  const map: Record<Complexity, number> = {
    trivial: 1,
    small: 2,
    medium: 3,
    large: 5,
    epic: 8,
  }
  return map[complexity]
}
