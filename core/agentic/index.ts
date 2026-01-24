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
export {
  default as memorySystem,
  MemorySystem,
  CachedStore,
  PatternStore,
  SemanticMemories,
  HistoryStore,
  SessionStore,
  MEMORY_TAGS,
} from './memory-system'

// ============ Planning ============
// Plan mode for complex tasks
export {
  default as planMode,
  PlanMode,
  generateApprovalPrompt,
  PLAN_STATUS,
  PLAN_REQUIRED_COMMANDS,
  DESTRUCTIVE_COMMANDS,
  PLANNING_TOOLS,
} from './plan-mode'

// ============ Execution ============
// Command execution, loop detection
export {
  default as commandExecutor,
  CommandExecutor,
  signalStart,
  signalEnd,
} from './command-executor'

export {
  default as loopDetector,
  LoopDetector,
  HALLUCINATION_PATTERNS,
  detectHallucination,
  getHallucinationSuggestion,
  isSimilarError,
  analyzeErrorPattern,
  generateEscalationMessage,
  generateSuggestion,
} from './loop-detector'

// ============ Context ============
// Context building and prompt generation
export { default as contextBuilder } from './context-builder'
export { default as smartContext } from './smart-context'
export { default as promptBuilder } from './prompt-builder'

// ============ Routing ============
// Agent routing and ground truth verification
export { default as AgentRouter } from './agent-router'
export {
  default as groundTruth,
  verify,
  prepareCommand,
  requiresVerification,
  verifiers,
  verifyDone,
  verifyShip,
  verifyFeature,
  verifyNow,
  verifyInit,
  verifySync,
  verifyAnalyze,
  verifySpec,
  formatDuration,
  escapeRegex,
  formatWarnings,
} from './ground-truth'

// ============ Tools ============
// Tool and template management
export { default as toolRegistry } from './tool-registry'
export { default as templateLoader } from './template-loader'
export { default as templateExecutor, TemplateExecutor } from './template-executor'
export { default as orchestratorExecutor, OrchestratorExecutor } from './orchestrator-executor'

// ============ Utilities ============
// Chain of thought, services
export { default as chainOfThought } from './chain-of-thought'
export { default as services } from './services'

// ============ Types ============
// All types re-exported from ../types (canonical source)
export type {
  // Memory types
  Memory,
  MemoryTag,
  MemoryDatabase,
  HistoryEntry,
  HistoryEventType,
  Decision,
  Workflow,
  Preference,
  Patterns,
  MemoryContext,
  MemoryContextParams,
  // Plan Mode types
  PlanParams,
  GatheredInfo,
  GatheredInfoType,
  GatheredFileData,
  GatheredAnalysisData,
  ProposedPlan,
  PlanStepDefinition,
  PlanStep,
  PlanStepResult,
  PlanStatus,
  Plan,
  PlanAnalysis,
  ApprovalPrompt,
  ApprovalOption,
  ApprovalContext,
  ChangedFile,
  ApprovalOperation,
  // Execution types
  ExecutionResult,
  SimpleExecutionResult,
  ExecutionToolsFn,
  // Loop Detector types
  ErrorEntry,
  AttemptRecord,
  ErrorPattern,
  EscalationInfo,
  AttemptResult,
  AttemptInfo,
  HallucinationPattern,
  HallucinationResult,
  OutputAnalysis,
  // Ground Truth types
  GroundTruthContext,
  VerificationResult,
  Verifier,
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
  PlanInfo,
  // Chain of Thought types
  ChainOfThoughtContext,
  ChainOfThoughtState,
  ReasoningStep,
  ReasoningResult,
  ChainOfThoughtResult,
  // Orchestrator types
  OrchestratorContext,
  LoadedAgent,
  LoadedSkill,
  OrchestratorSubtask,
} from '../types'
