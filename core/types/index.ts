/**
 * Core Types for prjct-cli
 *
 * Centralized type exports - all types are defined in dedicated files
 * and re-exported here for convenience.
 *
 * Import from here: import type { CommandResult, Session } from '../types'
 */

// =============================================================================
// Agentic System Types
// =============================================================================
export type {
  ApprovalContext,
  ApprovalOperation,
  ApprovalOption,
  ApprovalPrompt,
  AttemptInfo,
  AttemptRecord,
  AttemptResult,
  BashResult,
  // Chain of Thought types
  ChainOfThoughtContext,
  ChainOfThoughtResult,
  ChainOfThoughtState,
  ChangedFile,
  // Context types
  ContextDomain,
  ContextState,
  DomainAnalysis,
  // Loop Detector types
  ErrorEntry,
  ErrorPattern,
  EscalationInfo,
  // Command Executor types
  ExecutionResult,
  ExecutionToolsFn,
  FeatureInfo,
  FilteredContext,
  FilterMetrics,
  // Skill Loader types
  FormattedSkill,
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
  // Input Source types (PRJ-102)
  InputSource,
  LearnedPatterns,
  LearnedPatternsRecord,
  LoadedAgent,
  LoadedSkill,
  // Orchestrator types
  OrchestratorContext,
  OrchestratorSubtask,
  OutputAnalysis,
  // Template Loader types
  ParsedTemplate,
  PatternInfo,
  Plan,
  PlanAnalysis,
  PlanInfo,
  // Plan Mode types
  PlanParams,
  PlanStatus,
  PlanStep,
  PlanStepDefinition,
  PlanStepResult,
  PromptAgent,
  PromptContext,
  // Prompt types
  PromptProjectState,
  PromptState,
  ProposedPlan,
  RealCodebaseContext,
  ReasoningResult,
  ReasoningStep,
  // Sealed analysis context (PRJ-260)
  SealedAnalysisContext,
  SimpleExecutionResult,
  SkillContext,
  SmartContextProjectState,
  // Source tracking types (PRJ-102)
  SourcedItem,
  SourceMetadata,
  StackInfo,
  Template,
  ThinkBlock,
  ToolDefinition,
  // Tool types
  ToolFunction,
  ToolRegistry,
  ToolRegistryInterface,
  VerificationResult,
  Verifier,
} from './agentic'
export { createSourceMetadata } from './agentic'
// =============================================================================
// Agent Types
// =============================================================================
export type {
  Agent,
  AgentAssignmentResult,
  AgentInfo,
  AgentPerformance,
  AgentPerformanceSummary,
  AgentRouting,
  AgentSuggestion,
  AgentTaskRecord,
  AssignmentContext,
  TaskType,
} from './agents'
// =============================================================================
// Bus Types
// =============================================================================
export type {
  AnalysisCompletedPayload,
  BusEventType,
  EventCallback,
  EventData,
  EventMap,
  EventSubscription,
  FeaturePayload,
  GitCommitPayload,
  GitPushPayload,
  IdeaCapturedPayload,
  ProjectInitializedPayload,
  ProjectSyncedPayload,
  SessionCompletedPayload,
  SessionPausedPayload,
  SessionResumedPayload,
  SessionStartedPayload,
  SnapshotCreatedPayload,
  SnapshotRestoredPayload,
  TaskCompletedPayload,
  TaskCreatedPayload,
} from './bus'
export { EventTypes } from './bus'
// =============================================================================
// Citations Types
// =============================================================================
export type { ContextSources, SourceInfo, SourceType } from './citations'
// =============================================================================
// Command Types
// =============================================================================
export type {
  AnalyzeOptions,
  // Options types
  Author,
  AuthorEntry,
  BlockingRules,
  CategoryInfo,
  CleanupOptions,
  Command,
  CommandFeature,
  CommandHandler,
  CommandMeta,
  CommandMetadata,
  // Command function types
  CommandMethodName,
  CommandRegistry,
  // Core command types
  CommandResult,
  CommandStats,
  CommandUsage,
  // Analysis types
  ComplexityResult,
  DesignOptions,
  // Registry types
  ExecutionContext,
  // Config types (command-related)
  GlobalConfig as CommandGlobalConfig,
  HandlerFn,
  HealthResult,
  InitOptions,
  LayerCounts,
  MigrationConfig,
  // Migration types
  MigrationResult,
  RegistryCommandUsage,
  RegistryStats,
  SetupOptions,
  StandardCommandFn,
  UninstallOptions,
  ValidationResult as CommandValidationResult,
} from './commands'
// =============================================================================
// Config Types
// =============================================================================
export type {
  AuthorEntry as ConfigAuthorEntry,
  GlobalConfig,
  GlobalSettings,
  LocalConfig,
  ProjectConfig,
  ProjectSettings,
} from './config'
// =============================================================================
// Core Types
// =============================================================================
export type {
  CommandParams,
  CompressedContent,
  CompressionMetrics,
  ContextPaths,
  ProjectContext,
  ProjectState,
} from './core'
// =============================================================================
// Diff Types
// =============================================================================
export type {
  DiffOptions,
  DiffSection,
  ParsedMarkdownSection,
  PreservedInfo,
  SyncDiff,
} from './diff'
// =============================================================================
// Domain Types
// =============================================================================
export type {
  ParsedNowFile,
  TaskStackEntry,
  TaskStackMigrationResult,
  TaskStackSummary,
  TaskSwitchResult,
} from './domain'
// =============================================================================
// Error Types
// =============================================================================
export type { ErrorCode, ErrorWithHint } from './errors'
export { ERRORS } from './errors'
// =============================================================================
// Event Types
// =============================================================================
export type {
  SyncEvent,
  SyncEventType,
} from './events'
// =============================================================================
// File System Types
// =============================================================================
export type { NodeError } from './fs'
export {
  getErrorMessage,
  getErrorStack,
  isDirNotEmptyError,
  isFileExistsError,
  isNodeError,
  isNotFoundError,
  isPermissionError,
} from './fs'
// =============================================================================
// Infrastructure Types
// =============================================================================
export type {
  AgentCapabilities,
  AgentConfig,
  AgentEnvironment,
  AuthorConfigStatus,
  CheckResult,
  DetectedAgent,
  DetectedAuthorInfo,
  FileOperation,
  GlobalConfigResult,
  InstallResult,
  LayerType,
  MonorepoInfo,
  MonorepoPackage,
  PathSessionInfo,
  PermissionCheckResult,
  PermissionLevel,
  PermissionsConfig,
  SyncResult,
  UninstallResult,
} from './infrastructure'
// =============================================================================
// Integration Types
// =============================================================================
export type {
  IntegrationsConfig,
  JiraConfig,
  LinearConfig,
} from './integrations'
export { DEFAULT_JIRA_CONFIG, DEFAULT_LINEAR_CONFIG } from './integrations'
// =============================================================================
// JIRA Types
// =============================================================================
export type {
  JiraAuthMode,
  JiraIssue,
  JiraProject,
  JiraSearchResponse,
} from './jira'
// =============================================================================
// Logger Types
// =============================================================================
export type { LogFunction, Logger, LogLevel as LoggerLogLevel } from './logger'
// =============================================================================
// Memory Types
// =============================================================================
export type {
  Decision,
  HistoryEntry,
  HistoryEventType,
  LegacyMemorySource,
  Memory,
  MemoryContext,
  MemoryContextParams,
  MemoryDatabase,
  MemoryMetadata,
  MemoryQuery,
  MemoryTag,
  Patterns,
  Preference,
  Workflow,
} from './memory'
export { MEMORY_TAGS } from './memory'
// =============================================================================
// Outcome Types
// =============================================================================
export type {
  AgentMetrics,
  DetectedPattern,
  Outcome,
  OutcomeFilter,
  OutcomeInput,
  OutcomeSummary,
  QualityScore,
} from './outcomes'
// =============================================================================
// Output Types
// =============================================================================
export type { Output, OutputMetrics, OutputTier, TierConfig } from './output'
// =============================================================================
// Plugin Types
// =============================================================================
export type {
  WebhookConfig,
  WebhookPayload,
  WebhookPluginContext,
} from './plugin'
// =============================================================================
// Project Sync Types (sync-service / context-generator)
// =============================================================================
export type {
  AIToolResult,
  ContextGeneratorConfig,
  GitData,
  IncrementalInfo,
  ProjectCommands,
  ProjectStats,
  ProjectSyncResult,
  SyncAgentInfo,
  SyncMetrics,
  SyncOptions,
} from './project-sync'
// =============================================================================
// Provider Types (AI CLI abstraction)
// =============================================================================
export type {
  AIProviderConfig,
  AIProviderName,
  CommandFormat,
  ProviderBranding,
  ProviderDetectionResult,
  ProviderSelectionResult,
} from './provider'
// =============================================================================
// Server Types
// =============================================================================
export type {
  ServerConfig,
  ServerHandle,
  ServerInstance,
  SSEClient,
  SSEEventType,
  SSEInternalClient,
  SSEManager,
} from './server'
export { SSE_EVENTS } from './server'
// =============================================================================
// Service Types
// =============================================================================
export type {
  AIToolConfig,
  ComplexityEstimate,
  MemoryServiceEntry,
  Severity,
  Skill,
  SkillMetadata,
  SkillSearchResult,
} from './services'
// =============================================================================
// Session Types
// =============================================================================
export type {
  CompactedContext,
  CompactionConfig,
  ConversationTurn,
  Session,
  SessionEntry,
  SessionInfo,
  SessionLogMetadata,
  SessionMetrics,
  SessionMigrationResult,
  SessionStats,
  TimelineEvent,
} from './session'
// =============================================================================
// Stack Types
// =============================================================================
export type { StackDetection, StackPackageJson } from './stack'
// =============================================================================
// Storage Types
// =============================================================================
export type {
  AgentUsage,
  CodeMetrics,
  CommitInfo,
  DailyStats,
  Duration,
  Idea,
  IdeaModule,
  IdeaPriority,
  IdeaRole,
  IdeaStatus,
  IdeasJson,
  ImpactEffort,
  MetricsJson,
  QualityMetrics,
  ShipChange,
  ShippedFeature,
  ShippedJson,
  Storage,
  TechStack,
} from './storage'
// =============================================================================
// Sync Types
// =============================================================================
export type {
  AuthConfig,
  AuthResult,
  PullResult,
  PushResult,
  SyncBatchResult,
  SyncClientError,
  SyncManagerResult,
  SyncPullResult,
  SyncStatus,
} from './sync'
// =============================================================================
// Sync Verifier Types
// =============================================================================
export type {
  VerificationCheck,
  VerificationCheckResult,
  VerificationConfig,
  VerificationReport,
} from './sync-verifier'
// =============================================================================
// Task Types
// =============================================================================
export type {
  HistoricalAnalysis,
  ProjectAnalysisData,
  SemanticAnalysis,
  Task,
  TaskAnalysis,
  TaskMetadata,
} from './task'
// =============================================================================
// Template Types
// =============================================================================
export type {
  TemplateFrontmatter,
  ValidationRule,
} from './template'
// =============================================================================
// Utility Types
// =============================================================================
export type {
  AsyncFunction,
  CacheEntry,
  CacheOptions,
  CacheStats,
  DateComponents,
  DetectedProjectCommands,
  FileInfo,
  LogLevel,
  MaybePromise,
  Runtime,
} from './utils'
// =============================================================================
// Workflow Types
// =============================================================================
export type {
  HookCommand,
  HookPhase,
  HookResult,
  PreferenceScope,
  WorkflowPreference,
} from './workflow'
