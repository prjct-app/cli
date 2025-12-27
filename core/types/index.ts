/**
 * Core Types for prjct-cli
 *
 * Centralized type exports - all types are defined in dedicated files
 * and re-exported here for convenience.
 *
 * Import from here: import type { CommandResult, Session } from '../types'
 */

// =============================================================================
// File System Types
// =============================================================================
export type { NodeError } from './fs'
export {
  isNotFoundError,
  isPermissionError,
  isDirNotEmptyError,
  isFileExistsError,
  isNodeError,
} from './fs'

// =============================================================================
// Command Types
// =============================================================================
export type {
  // Core command types
  CommandResult,
  CommandUsage,
  CommandMetadata,
  CommandFeature,
  Command,
  CommandRegistry,
  CommandStats,
  // Options types
  Author,
  DesignOptions,
  CleanupOptions,
  SetupOptions,
  MigrateOptions,
  AnalyzeOptions,
  // Migration types
  MigrationResult,
  LayerCounts,
  MigrationConfig,
  // Analysis types
  ComplexityResult,
  HealthResult,
  // Command function types
  CommandMethodName,
  StandardCommandFn,
  // Registry types
  ExecutionContext,
  CommandHandler,
  HandlerFn,
  RegistryCommandUsage,
  BlockingRules,
  CommandMeta,
  CategoryInfo,
  RegistryStats,
  ValidationResult as CommandValidationResult,
  // Config types (command-related)
  GlobalConfig as CommandGlobalConfig,
  AuthorEntry,
} from './commands'

// =============================================================================
// Agent Types
// =============================================================================
export type {
  TaskType,
  AgentPerformance,
  AgentTaskRecord,
  AgentSuggestion,
  AgentPerformanceSummary,
  Agent,
  AgentInfo,
  AgentRouting,
  AssignmentContext,
  AgentAssignmentResult,
} from './agents'

// =============================================================================
// Agentic System Types
// =============================================================================
export type {
  // Tool types
  ToolFunction,
  ToolRegistryInterface,
  ToolDefinition,
  ToolRegistry,
  BashResult,
  // Context types
  ContextDomain,
  ContextState,
  SmartContextProjectState,
  FullContext,
  FilteredContext,
  FeatureInfo,
  PatternInfo,
  StackInfo,
  FilterMetrics,
  DomainAnalysis,
  // Prompt types
  PromptProjectState,
  Frontmatter,
  Template,
  PromptAgent,
  PromptContext,
  PromptState,
  LearnedPatternsRecord,
  ThinkBlock,
  PlanInfo,
  LearnedPatterns,
  // Ground Truth types
  GroundTruthContext,
  VerificationResult,
  Verifier,
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
  // Command Executor types
  ExecutionResult,
  SimpleExecutionResult,
  ExecutionToolsFn,
  // Template Loader types
  ParsedTemplate,
  // Skill Loader types
  FormattedSkill,
  SkillContext,
  // Chain of Thought types
  ChainOfThoughtContext,
  ChainOfThoughtState,
  ReasoningStep,
  ReasoningResult,
  ChainOfThoughtResult,
} from './agentic'

// =============================================================================
// Session Types
// =============================================================================
export type {
  Session,
  SessionMetrics,
  TimelineEvent,
  SessionEntry,
  SessionLogMetadata,
  SessionStats,
  SessionMigrationResult,
  SessionInfo,
  ConversationTurn,
  CompactedContext,
  CompactionConfig,
} from './session'

// =============================================================================
// Memory Types
// =============================================================================
export type {
  Memory,
  MemoryMetadata,
  MemoryQuery,
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
} from './memory'
export { MEMORY_TAGS } from './memory'

// =============================================================================
// Task Types
// =============================================================================
export type {
  Task,
  TaskMetadata,
  TaskAnalysis,
  SemanticAnalysis,
  HistoricalAnalysis,
  ProjectAnalysisData,
} from './task'

// =============================================================================
// Config Types
// =============================================================================
export type {
  LocalConfig,
  GlobalConfig,
  AuthorEntry as ConfigAuthorEntry,
  ProjectConfig,
  ProjectSettings,
  GlobalSettings,
} from './config'

// =============================================================================
// Template Types
// =============================================================================
export type {
  TemplateFrontmatter,
  ValidationRule,
} from './template'

// =============================================================================
// Core Types
// =============================================================================
export type {
  ContextPaths,
  CommandParams,
  ProjectContext,
  ProjectState,
  CompressionMetrics,
  CompressedContent,
} from './core'

// =============================================================================
// Event Types
// =============================================================================
export type {
  SyncEvent,
  SyncEventType,
} from './events'

// =============================================================================
// Bus Types
// =============================================================================
export type {
  BusEventType,
  EventData,
  EventCallback,
  EventSubscription,
} from './bus'
export { EventTypes } from './bus'

// =============================================================================
// Storage Types
// =============================================================================
export type {
  Storage,
  ShippedFeature,
  ShipChange,
  CommitInfo,
  CodeMetrics,
  QualityMetrics,
  Duration,
  ShippedJson,
  Idea,
  IdeaStatus,
  IdeaPriority,
  ImpactEffort,
  TechStack,
  IdeaModule,
  IdeaRole,
  IdeasJson,
} from './storage'

// =============================================================================
// Infrastructure Types
// =============================================================================
export type {
  PathSessionInfo,
  LayerType,
  InstallResult,
  UninstallResult,
  CheckResult,
  SyncResult,
  GlobalConfigResult,
  PermissionLevel,
  FileOperation,
  PermissionsConfig,
  PermissionCheckResult,
  AgentCapabilities,
  AgentConfig,
  AgentEnvironment,
  DetectedAgent,
  DetectedAuthorInfo,
  AuthorConfigStatus,
} from './infrastructure'

// =============================================================================
// Outcome Types
// =============================================================================
export type {
  QualityScore,
  Outcome,
  OutcomeSummary,
  OutcomeFilter,
  OutcomeInput,
  DetectedPattern,
  AgentMetrics,
} from './outcomes'

// =============================================================================
// Utility Types
// =============================================================================
export type {
  AsyncFunction,
  MaybePromise,
  FileInfo,
  LogLevel,
  DateComponents,
  CacheEntry,
  CacheOptions,
  CacheStats,
  DetectedProjectCommands,
  Runtime,
} from './utils'

// =============================================================================
// Plugin Types
// =============================================================================
export type {
  WebhookConfig,
  WebhookPluginContext,
  WebhookPayload,
} from './plugin'

// =============================================================================
// Service Types
// =============================================================================
export type {
  Severity,
  ComplexityEstimate,
  SkillMetadata,
  Skill,
  SkillSearchResult,
  MemoryServiceEntry,
} from './services'

// =============================================================================
// Domain Types
// =============================================================================
export type {
  TaskStackEntry,
  ParsedNowFile,
  TaskStackMigrationResult,
  TaskSwitchResult,
  TaskStackSummary,
} from './domain'

// =============================================================================
// Sync Types
// =============================================================================
export type {
  AuthResult,
  AuthConfig,
  SyncManagerResult,
  PushResult,
  PullResult,
  SyncBatchResult,
  SyncPullResult,
  SyncStatus,
  SyncClientError,
} from './sync'

// =============================================================================
// Server Types
// =============================================================================
export type {
  ServerConfig,
  ServerInstance,
  SSEClient,
  SSEManager,
  SSEEventType,
} from './server'
