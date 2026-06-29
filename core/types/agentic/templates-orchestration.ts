/**
 * Template Loader, Skill Loader, Chain of Thought, Learned Patterns,
 * Context Health types.
 * Split out of agentic.ts to keep each file under 500 LOC.
 */

import type { Frontmatter, SmartContextProjectState } from '../agentic'

// Template Loader Types

export interface ParsedTemplate {
  frontmatter: Frontmatter
  content: string
  raw?: string
}

// Skill Loader Types

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

// Chain of Thought Types

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

// Learned Patterns Type

export interface LearnedPatterns {
  commit_footer?: string | null
  branch_naming?: string | null
  test_before_ship?: string | null
  preferred_agent?: string | null
  [key: string]: string | null | undefined
}

// Context Health (Dex Horthy context management)

/** Context zone based on usage percentage of input budget */
export type ContextZone = 'smart' | 'warning' | 'dumb'

/** Current context health status with zone and usage metrics */
export interface ContextHealthStatus {
  zone: ContextZone
  usagePercent: number
  usedTokens: number
  budgetTokens: number
  recommendation: string | null
}

/** Records a zone transition event */
export interface ZoneTransition {
  from: ContextZone
  to: ContextZone
  usagePercent: number
  timestamp: string
  action: string | null
}

// Response Validator Types

export interface ValidationSuccess<T> {
  success: true
  data: T
}

export interface ValidationFailure {
  success: false
  error: string
  /** Raw parsed JSON (may be partial) */
  rawParsed: unknown
  /** Zod validation issues */
  issues: string[]
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

// Token Budget Types

/** Budget category identifiers ordered by priority */
export type BudgetCategory = 'state' | 'injection' | 'files'

/** Budget allocation result for each category */
export interface BudgetAllocation {
  state: number
  injection: number
  files: number
  inputBudget: number
  outputReserve: number
  contextWindow: number
}

/** Usage tracking per category */
export interface BudgetUsage {
  category: BudgetCategory
  allocated: number
  used: number
  remaining: number
}

// Agentic Services Types

/**
 * Re-exported from core/agentic/services.ts.
 * Import the actual `AgenticServices` from there for its `typeof` members.
 */

// Hook Types

export type HookPoint = string

// Context Builder Convenience Aliases

// Note: Paths, Context, State are re-exports of ContextPaths, ProjectContext,
// ContextState from core/types/core and core/types/agentic respectively.

// Anti-Hallucination Types

export interface ProjectGroundTruth {
  /** Project root path */
  projectPath: string
  /** Programming language (e.g., 'TypeScript', 'JavaScript', 'Python') */
  language?: string
  /** Primary framework (e.g., 'Hono', 'Next.js', 'Express') */
  framework?: string
  /** Technology stack items (e.g., ['Hono', 'Zod', 'Vitest']) */
  techStack?: string[]
  /** Domain flags from sealed analysis */
  domains?: {
    hasFrontend?: boolean
    hasBackend?: boolean
    hasDatabase?: boolean
    hasTesting?: boolean
    hasDocker?: boolean
  }
  /** Total files in project */
  fileCount?: number
  /** Sealed analysis languages — used to ground available tech (PRJ-260) */
  analysisLanguages?: string[]
  /** Sealed analysis frameworks — used to ground available tech (PRJ-260) */
  analysisFrameworks?: string[]
  /** Package manager from sealed analysis (PRJ-260) */
  analysisPackageManager?: string
}

// Environment Block Types

export interface EnvironmentBlockInput {
  /** Project display name */
  projectName: string
  /** Absolute path to project root */
  projectPath: string
  /** Whether the project is a git repository */
  isGitRepo?: boolean
  /** Current git branch name */
  gitBranch?: string
  /** Operating system platform (auto-detected if not provided) */
  platform?: string
  /** JavaScript runtime (auto-detected if not provided) */
  runtime?: string
  /** Current date in ISO format (auto-generated if not provided) */
  date?: string
  /** AI model identifier (e.g., 'opus', 'sonnet', '2.5-pro') */
  model?: string
  /** AI provider name (e.g., 'claude', 'gemini', 'cursor') */
  provider?: string
}

// Prompt Builder Types (Section Priority)

/**
 * Prompt section priorities for budget trimming.
 */
export type SectionPriority = 'critical' | 'important' | 'optional'

// Injection Validator Types

/** Configurable token budgets per injection section */
export interface InjectionBudgets {
  /** Auto-injected context (task + queue + patterns) */
  autoContext: number
  /** State data section */
  stateData: number
  /** Memories section */
  memories: number
  /** Total prompt ceiling (all sections combined) */
  totalPrompt: number
}

// Template Executor Types

export interface TemplateExecutionContext {
  projectPath: string
  projectId: string
  globalPath: string
  command: string
  args: string

  // Agent information
  agentName: string
  agentSettingsPath: string

  // Paths for execution (not content)
  paths: {
    orchestrator: string
    taskFragmentation: string
    commandTemplate: string
    repoAnalysis: string
    skillsDir: string
    stateJson: string
  }
}

export interface AgenticPromptInfo {
  prompt: string
  context: TemplateExecutionContext
  requiresOrchestration: boolean
}

// Smart Context Types

export type ProjectState = SmartContextProjectState
