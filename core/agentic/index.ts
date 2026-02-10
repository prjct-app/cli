/**
 * Agentic Module - Central exports for agentic capabilities
 *
 * Organized into logical groups:
 * - Memory: Pattern learning, semantic memories, history
 * - Planning: Plan mode, approval flows
 * - Execution: Command executor, loop detection
 * - Context: Context building, smart context, prompt generation
 * - Routing: Agent router, ground truth verification
 * - Plugins: Hook system, plugin loader, plugin registry
 * - Performance: Agent performance tracking
 * - Tools: Tool registry, template loader
 */

// ============ Routing ============
// Agent routing and ground truth verification
export { default as AgentRouter } from './agent-router'
// ============ Utilities ============
// Chain of thought, services
export {
  default as chainOfThought,
  formatPlan,
  REASONING_REQUIRED_COMMANDS,
  reason,
  requiresReasoning,
} from './chain-of-thought'
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
export { DomainClassifier, default as domainClassifier } from './domain-classifier'
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
// ============ Plugins ============
// Hook system, plugin loading, plugin registry
export { HookPoints, HookSystem, hookSystem, hooks } from './hooks'
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
  MemorySystem,
  PatternStore,
  SemanticMemories,
  SessionStore,
} from './memory-system'
export { default as orchestratorExecutor, OrchestratorExecutor } from './orchestrator-executor'
// ============ Performance ============
// Agent performance tracking and routing
export { AgentPerformanceTracker, default as agentPerformanceTracker } from './performance'
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
export { PluginLoader, pluginLoader } from './plugin-loader'
export { PluginRegistry, pluginRegistry } from './plugin-registry'
export { default as promptBuilder } from './prompt-builder'
export { default as services } from './services'
export { default as smartContext } from './smart-context'
export { default as templateExecutor, TemplateExecutor } from './template-executor'
export {
  clearCache,
  default as templateLoader,
  getAllowedTools,
  load,
  parseFrontmatter,
} from './template-loader'
// ============ Tools ============
// Tool and template management
export { default as toolRegistry } from './tool-registry'
