/**
 * Storage Types
 * Types for data persistence layer.
 */

// =============================================================================
// Project JSON Types (project.json)
// =============================================================================

export interface ProjectJson {
  projectId: string
  repoPath?: string
  path?: string
  name?: string
  version?: string
  cliVersion?: string
  techStack?: string[]
  fileCount?: number
  commitCount?: number
  stack?: string
  currentBranch?: string
  hasUncommittedChanges?: boolean
  createdAt?: string
  lastSync?: string
  integrations?: {
    linear?: {
      enabled: boolean
      authMode?: string
      teamId?: string
      teamName?: string
      teamKey?: string
      setupAt?: string
    }
    jira?: {
      enabled: boolean
    }
  }
  lastSyncCommit?: string
  lastSyncBranch?: string
  hooks?: {
    enabled: boolean
    strategy?: string
    hooks?: unknown[]
  }
}

// =============================================================================
// State JSON Types (state.json)
// =============================================================================

export interface StateTask {
  id: string
  description: string
  type?: string
  status: string
  startedAt: string
  shippedAt?: string
  prUrl?: string
  subtasks?: Array<{ description: string; status: string }>
  currentSubtaskIndex?: number
  parentDescription?: string
  branch?: string
  linearId?: string | null
  linearUuid?: string | null
  duration?: string
  sessionId?: string
  featureId?: string
  pausedAt?: string
  pauseReason?: string
  expectedValue?: {
    type: string
    impact: string
    successCriteria: string[]
  }
}

export interface StateJson {
  currentTask: StateTask | null
  pausedTasks?: StateTask[]
  previousTask: StateTask | null
  lastUpdated?: string
  projectId?: string
  stack?: { language: string; framework: string }
  domains?: Record<string, boolean>
  projectType?: string
  metrics?: { totalFiles: number }
  lastSync?: string
  context?: {
    lastSession: string
    lastAction: string
    nextAction: string
  }
}

// =============================================================================
// Queue JSON Types (queue.json)
// =============================================================================

export interface QueueTask {
  id: string
  description: string
  body?: string
  type?: string
  priority?: string
  section?: string
  createdAt: string
  completed?: boolean
  completedAt?: string
  featureId?: string
  featureName?: string
}

export interface TaskComment {
  id: string
  taskId: string
  author: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface QueueJson {
  tasks: QueueTask[]
  lastUpdated?: string
}

// =============================================================================
// Roadmap JSON Types (roadmap.json)
// =============================================================================

export interface RoadmapJson {
  features: unknown[]
  backlog: unknown[]
  lastUpdated: string
}

// =============================================================================
// Shipped Storage Types
// =============================================================================

/**
 * Shipped feature record (simple version used by shipped-storage.ts)
 */
export interface ShippedFeature {
  id: string
  name: string
  shippedAt: string
  version: string
  description?: string
  tasks?: string[]
  duration?: string
  type?: 'feature' | 'fix' | 'improvement' | 'refactor'
  agent?: string
  changes?: ShipChange[]
  codeSnippets?: string[]
  commit?: CommitInfo
  codeMetrics?: CodeMetrics
  qualityMetrics?: QualityMetrics
  quantitativeImpact?: string
  tasksCompleted?: number
  featureId?: string
}

export interface ShipChange {
  description: string
  type: 'added' | 'changed' | 'fixed' | 'removed'
}

export interface CommitInfo {
  hash: string
  message: string
  branch: string
}

export interface CodeMetrics {
  filesChanged: number
  linesAdded: number
  linesRemoved: number
  commits: number
}

export interface QualityMetrics {
  lintStatus: 'pass' | 'warning' | 'fail' | 'skipped'
  lintDetails?: string
  testStatus: 'pass' | 'warning' | 'fail' | 'skipped'
  testDetails?: string
}

export interface Duration {
  hours: number
  minutes: number
  totalMinutes: number
}

/**
 * Shipped items collection
 */
export interface ShippedJson {
  shipped: ShippedFeature[]
  lastUpdated: string
}

// =============================================================================
// Ideas Storage Types
// =============================================================================

export type IdeaStatus = 'pending' | 'converted' | 'completed' | 'archived' | 'dormant'
export type IdeaPriority = 'low' | 'medium' | 'high'

/**
 * Idea record
 */
export interface Idea {
  id: string
  text: string
  status: IdeaStatus
  priority: IdeaPriority
  tags: string[]
  addedAt: string
  convertedTo?: string
  details?: string
  painPoints?: string[]
  solutions?: string[]
  filesAffected?: string[]
  impactEffort?: ImpactEffort
  stack?: TechStack
  modules?: IdeaModule[]
  roles?: IdeaRole[]
  risks?: string[]
  risksCount?: number
  createdAt?: string
}

export interface ImpactEffort {
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
}

export interface TechStack {
  frontend?: string
  backend?: string
  payments?: string
  ai?: string
  deploy?: string
  other?: string[]
}

export interface IdeaModule {
  name: string
  description: string
}

export interface IdeaRole {
  name: string
  description: string
}

/**
 * Ideas collection
 */
export interface IdeasJson {
  ideas: Idea[]
  lastUpdated: string
}

// =============================================================================
// Metrics Storage Types
// =============================================================================

/**
 * Daily stats for trend analysis
 */
export interface DailyStats {
  date: string // YYYY-MM-DD
  tokensSaved: number // Tokens saved that day
  syncs: number // Number of syncs
  avgCompressionRate: number // Average compression rate (0-1)
  totalDuration: number // Total sync time in ms
}

/**
 * Agent usage tracking
 */
export interface AgentUsage {
  agentName: string // e.g., "backend", "frontend"
  usageCount: number // Times invoked
  tokensSaved: number // Tokens saved by this agent
}

/**
 * Metrics collection for value dashboard
 */
export interface MetricsJson {
  // Token metrics
  totalTokensSaved: number
  avgCompressionRate: number // 0-1 (e.g., 0.63 = 63% reduction)

  // Sync metrics
  syncCount: number
  watchTriggers: number // Auto-syncs from watch mode
  avgSyncDuration: number // Average in ms
  totalSyncDuration: number // Total in ms

  // Agent usage
  agentUsage: AgentUsage[]

  // Time series for trends
  dailyStats: DailyStats[]

  // Metadata
  firstSync: string // ISO8601 - when tracking started
  lastUpdated: string // ISO8601
}

// =============================================================================
// Archive Storage Types (from archive-storage.ts)
// =============================================================================

export type ArchiveEntityType = 'shipped' | 'idea' | 'queue_task' | 'paused_task' | 'memory_entry'

export interface ArchiveRecord {
  id: string
  entity_type: ArchiveEntityType
  entity_id: string
  entity_data: string
  summary: string | null
  archived_at: string
  reason: string
}

export interface ArchiveItem {
  entityType: ArchiveEntityType
  entityId: string
  entityData: unknown
  summary?: string
  reason: string
}

export interface ArchiveStats {
  shipped: number
  idea: number
  queue_task: number
  paused_task: number
  memory_entry: number
  total: number
}

// =============================================================================
// Custom Workflow Storage Types (from custom-workflow-storage.ts)
// =============================================================================

export interface CustomWorkflow {
  id: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  isBuiltin: boolean
  enabled: boolean
  metadata: Record<string, unknown> | null
}

// =============================================================================
// Database Types (from database.ts)
// =============================================================================

import type { SqliteDatabase } from '../storage/database.js'

export interface Migration {
  version: number
  name: string
  up: (db: SqliteDatabase) => void
}

export interface MigrationRecord {
  version: number
  name: string
  applied_at: string
}

// =============================================================================
// Workflow Rule Storage Types (from workflow-rule-storage.ts)
// =============================================================================

export interface WorkflowRule {
  id: number
  type: 'hook' | 'gate' | 'step' | 'instruction'
  command: string
  position: string
  action: string
  description: string | null
  enabled: boolean
  timeoutMs: number
  createdAt: string
  sortOrder: number
}

// =============================================================================
// Safe Reader Types (from safe-reader.ts)
// =============================================================================

import type { ZodError } from 'zod'

/**
 * Minimal interface for Zod-like validation.
 * Decoupled from Zod generics to avoid strict type parameter matching.
 */
export interface ValidationSchema {
  safeParse(data: unknown): { success: boolean; error?: ZodError }
}

// =============================================================================
// Migrate JSON Types (from migrate-json.ts)
// =============================================================================

export interface MigrationResult {
  success: boolean
  migratedFiles: string[]
  skippedFiles: string[]
  errors: Array<{ file: string; error: string }>
  backupDir: string | null
  duration: number
}

// =============================================================================
// System Database Types (from system-database.ts)
// =============================================================================

export interface McpHealthRow {
  provider: string
  status: 'healthy' | 'unhealthy' | 'unconfigured'
  last_checked: string
  last_error: string | null
  token_version: string | null
  config_valid: number
  oauth_valid: number
  updated_at: string
}

export interface McpHealthStatus {
  status: 'healthy' | 'unhealthy' | 'unconfigured'
  lastError?: string | null
  tokenVersion?: string | null
  configValid?: boolean
  oauthValid?: boolean
}

// =============================================================================
// Index Storage Types (from index-storage.ts)
// =============================================================================

export interface LanguageStats {
  count: number // Number of files
  totalLines: number // Total lines of code
  totalSize: number // Total bytes
}

export interface ConfigFileEntry {
  path: string
  type: string // "package.json", "Cargo.toml", etc.
  checksum: string
  parsed?: Record<string, unknown>
}

export interface DirectoryEntry {
  path: string
  type: 'source' | 'test' | 'config' | 'build' | 'vendor' | 'docs' | 'unknown'
  fileCount: number
}

export interface ScoredFile {
  path: string
  score: number
  size: number
  mtime: string // ISO timestamp
  categories?: string[] // Domain categories: ['payments', 'api', 'backend']
}

export interface DetectedPattern {
  name: string // "monorepo", "api-first", "component-based"
  confidence: number // 0-1
  evidence: string[] // Files/dirs that evidence this pattern
}

export interface DetectedStack {
  ecosystem: string // "JavaScript", "Python", "Rust", etc.
  frameworks: string[] // Detected frameworks
  hasTests: boolean
  hasDocker: boolean
  hasCi: boolean
  buildTool: string | null
}

export interface ProjectIndex {
  version: string
  projectPath: string
  lastFullScan: string // ISO timestamp
  lastIncrementalUpdate: string // ISO timestamp

  // Language detection by extension
  languages: Record<string, LanguageStats>

  // Config files found
  configFiles: ConfigFileEntry[]

  // Directory structure (top-level relevant)
  directories: DirectoryEntry[]

  // Files with score > threshold
  relevantFiles: ScoredFile[]

  // Detected patterns
  patterns: DetectedPattern[]

  // Stack detection
  detectedStack: DetectedStack

  // Metrics
  totalFiles: number
  totalSize: number // Total bytes
  totalLines: number // Total LOC
  scanDuration: number // ms
}

export interface FileChecksums {
  version: string
  lastUpdated: string
  checksums: Record<string, string> // path -> checksum
}

/**
 * A domain discovered by LLM analysis of the project
 */
export interface DomainDefinition {
  name: string // "payments", "shipping", "inventory"
  description: string // "Handles payment processing, Stripe integration"
  keywords: string[] // ["stripe", "checkout", "billing"]
  filePatterns: string[] // ["**/payments/**", "**/billing/**"]
  fileCount: number // Number of files in this domain
}

/**
 * Discovered domains for a project
 */
export interface DiscoveredDomains {
  version: string
  projectId: string
  domains: DomainDefinition[]
  discoveredAt: string // ISO timestamp
}

/**
 * Category assignment for a single file
 */
export interface FileCategory {
  path: string
  categories: string[] // ['payments', 'users', 'api']
  primaryDomain: string // 'payments'
  confidence: number // 0-1
  categorizedAt: string // ISO timestamp
  method: 'llm' | 'heuristic' // How it was categorized
}

/**
 * Cache of file categorizations
 */
export interface CategoriesCache {
  version: string
  lastUpdate: string
  fileCategories: FileCategory[]
  domainIndex: Record<string, string[]> // domain -> file paths
}
