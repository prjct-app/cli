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

// ============ Types ============
// All types re-exported from ../types (canonical source)
export type {
  // Agent router types
  Agent,
  AgentInfo,
  ApprovalContext,
  ApprovalOperation,
  ApprovalOption,
  ApprovalPrompt,
  AssignmentContext,
  AttemptInfo,
  AttemptRecord,
  AttemptResult,
  // Chain of Thought types
  ChainOfThoughtContext,
  ChainOfThoughtResult,
  ChainOfThoughtState,
  ChangedFile,
  // Smart context types
  ContextDomain,
  // Context builder types
  ContextPaths,
  ContextState,
  Decision,
  DomainAnalysis,
  // Loop Detector types
  ErrorEntry,
  ErrorPattern,
  EscalationInfo,
  // Execution types
  ExecutionResult,
  ExecutionToolsFn,
  FeatureInfo,
  FilteredContext,
  FilterMetrics,
  // Prompt builder types
  Frontmatter,
  FullContext,
  GatheredAnalysisData,
  GatheredFileData,
  GatheredInfo,
  GatheredInfoType,
  // Ground Truth types
  GroundTruthContext,
  HallucinationPattern,
  HallucinationResult,
  HistoryEntry,
  HistoryEventType,
  LearnedPatterns,
  LoadedAgent,
  LoadedSkill,
  // Memory types
  Memory,
  MemoryContext,
  MemoryContextParams,
  MemoryDatabase,
  MemoryTag,
  // Orchestrator types
  OrchestratorContext,
  OrchestratorSubtask,
  OutputAnalysis,
  PatternInfo,
  Patterns,
  Plan,
  PlanAnalysis,
  PlanInfo,
  // Plan Mode types
  PlanParams,
  PlanStatus,
  PlanStep,
  PlanStepDefinition,
  PlanStepResult,
  Preference,
  ProjectContext,
  ProposedPlan,
  ReasoningResult,
  ReasoningStep,
  SimpleExecutionResult,
  StackInfo,
  Template,
  ThinkBlock,
  // Tool registry types
  ToolFunction,
  ToolRegistryInterface,
  VerificationResult,
  Verifier,
  Workflow,
} from '../types'
// ============ Routing ============
// Agent routing and ground truth verification
export { default as AgentRouter } from './agent-router'
// ============ Utilities ============
// Chain of thought, services
export { default as chainOfThought } from './chain-of-thought'
// ============ Execution ============
// Command execution, loop detection
export {
  CommandExecutor,
  default as commandExecutor,
  signalEnd,
  signalStart,
} from './command-executor'

// ============ Context ============
// Context building and prompt generation
export { default as contextBuilder } from './context-builder'
export {
  default as groundTruth,
  escapeRegex,
  formatDuration,
  formatWarnings,
  prepareCommand,
  requiresVerification,
  verifiers,
  verify,
  verifyAnalyze,
  verifyDone,
  verifyFeature,
  verifyInit,
  verifyNow,
  verifyShip,
  verifySpec,
  verifySync,
} from './ground-truth'
export {
  analyzeErrorPattern,
  default as loopDetector,
  detectHallucination,
  generateEscalationMessage,
  generateSuggestion,
  getHallucinationSuggestion,
  HALLUCINATION_PATTERNS,
  isSimilarError,
  LoopDetector,
} from './loop-detector'
// ============ Memory ============
// Pattern learning, semantic memories, session history
export {
  CachedStore,
  default as memorySystem,
  HistoryStore,
  MEMORY_TAGS,
  MemorySystem,
  PatternStore,
  SemanticMemories,
  SessionStore,
} from './memory-system'
export { default as orchestratorExecutor, OrchestratorExecutor } from './orchestrator-executor'
// ============ Planning ============
// Plan mode for complex tasks
export {
  DESTRUCTIVE_COMMANDS,
  default as planMode,
  generateApprovalPrompt,
  PLAN_REQUIRED_COMMANDS,
  PLAN_STATUS,
  PLANNING_TOOLS,
  PlanMode,
} from './plan-mode'
export { default as promptBuilder } from './prompt-builder'
export { default as services } from './services'
export { default as smartContext } from './smart-context'
export { default as templateExecutor, TemplateExecutor } from './template-executor'
export { default as templateLoader } from './template-loader'
// ============ Tools ============
// Tool and template management
export { default as toolRegistry } from './tool-registry'
