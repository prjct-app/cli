/**
 * Agentic Module - Central exports for agentic capabilities
 *
 * Organized into logical groups:
 * - Memory: Pattern learning, semantic memories, history
 * - Planning: Plan mode, approval flows
 * - Execution: Command executor, loop detection
 * - Context: Context building, smart context, prompt generation
 * - Routing: Agent router, ground truth verification
 * - Tools: Tool registry, template loader
 */

// ============ Memory ============
// Pattern learning, semantic memories, session history
export { default as memorySystem, MemorySystem, MEMORY_TAGS, CachedStore } from './memory-system/index'
export { PatternStore } from './memory-system/patterns'
export { SemanticMemories } from './memory-system/semantic-memories'
export { HistoryStore } from './memory-system/history'
export type { Memory, MemoryContext, Preference, Workflow, HistoryEventType, Patterns } from './memory-system/types'

// ============ Planning ============
// Plan mode for complex tasks
export { default as planMode, PlanMode } from './plan-mode/index'
export { PLAN_STATUS, PLAN_REQUIRED_COMMANDS, DESTRUCTIVE_COMMANDS, PLANNING_TOOLS } from './plan-mode/constants'
export { generateApprovalPrompt } from './plan-mode/approval'
export type { PlanParams, GatheredInfo, ProposedPlan, PlanStep, Plan, ApprovalPrompt, ApprovalContext, ApprovalOperation } from './plan-mode/types'

// ============ Execution ============
// Command execution, loop detection
export { default as commandExecutor, CommandExecutor } from './command-executor/index'
export { signalStart, signalEnd } from './command-executor/status-signal'
export type { ExecutionResult, SimpleExecutionResult, ExecutionToolsFn } from './command-executor/types'

export { default as loopDetector, LoopDetector } from './loop-detector/index'
export { HALLUCINATION_PATTERNS, detectHallucination, getHallucinationSuggestion } from './loop-detector/hallucination'
export { isSimilarError, analyzeErrorPattern, generateEscalationMessage, generateSuggestion } from './loop-detector/error-analysis'
export type { ErrorEntry, AttemptRecord, ErrorPattern, EscalationInfo, AttemptResult, AttemptInfo, HallucinationPattern, HallucinationResult, OutputAnalysis } from './loop-detector/types'

// ============ Context ============
// Context building and prompt generation
export { default as contextBuilder } from './context-builder'
export { default as smartContext } from './smart-context'
export { default as promptBuilder } from './prompt-builder'

// ============ Routing ============
// Agent routing and ground truth verification
export { default as AgentRouter } from './agent-router'
export { default as groundTruth, verify, prepareCommand, requiresVerification, verifiers } from './ground-truth/index'
export { formatDuration, escapeRegex, formatWarnings } from './ground-truth/utils'
export type { Context as GroundTruthContext, VerificationResult, Verifier } from './ground-truth/types'

// ============ Tools ============
// Tool and template management
export { default as toolRegistry } from './tool-registry'
export { default as templateLoader } from './template-loader'

// ============ Utilities ============
// Chain of thought, services
export { default as chainOfThought } from './chain-of-thought'
export { default as services } from './services'

// ============ Types ============
// Shared type definitions
export type {
  // Tool registry types
  ToolFunction,
  ToolRegistryInterface,
  // Agent router types
  Agent,
  AssignmentContext,
  // Context builder types
  ContextPaths,
  ProjectContext,
  ContextState,
  // Smart context types
  ContextDomain,
  FullContext,
  FilteredContext,
  AgentInfo,
  FeatureInfo,
  PatternInfo,
  StackInfo,
  FilterMetrics,
  DomainAnalysis,
  // Prompt builder types
  Frontmatter,
  Template,
  LearnedPatterns,
  ThinkBlock,
  Memory as PromptMemory,
  PlanInfo,
} from './agentic.types'
