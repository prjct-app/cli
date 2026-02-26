/**
 * Service Types
 * Types for service layer modules.
 */

// =============================================================================
// Breakdown Service Types
// =============================================================================

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export interface ComplexityEstimate {
  level: 'low' | 'medium' | 'high'
  hours: number
  confidence?: number
  factors?: string[]
}

// =============================================================================
// Skill Service Types
// =============================================================================

export interface SkillMetadata {
  name: string
  description?: string
  agent?: string
  tags?: string[]
  version?: string
  category?: string
  author?: string
  // Ecosystem compatibility fields
  sourceUrl?: string
  sourceType?: 'github' | 'local' | 'builtin' | 'registry'
  installedAt?: string
  sha?: string
}

export interface Skill {
  id: string
  name: string
  description: string
  content: string
  source: 'project' | 'global' | 'builtin' | 'remote'
  filePath: string
  metadata: SkillMetadata
  path?: string
  isBuiltin?: boolean
}

export interface SkillSearchResult {
  skill: Skill
  relevance: number
  score?: number
  matchedTerms?: string[]
}

// =============================================================================
// AI Tools Registry Types
// =============================================================================

export interface AIToolConfig {
  id: string
  name: string
  outputFile: string
  outputPath: 'repo' | 'global'
  maxTokens: number
  format: 'detailed' | 'concise' | 'minimal' | 'json'
  description: string
}

// =============================================================================
// Memory Service Types
// =============================================================================

export interface MemoryServiceEntry {
  id?: string
  type?: string
  content?: string
  timestamp: string
  action: string
  data: Record<string, unknown>
  author?: string
  metadata?: Record<string, unknown>
}

// =============================================================================
// --- Extracted from core/services ---
// =============================================================================

// --- Pattern Extractor Types ---

export interface ExtractedPattern {
  name: string
  description: string
  location?: string
  severity?: 'low' | 'medium' | 'high'
  language?: string
  framework?: string
  source: 'baseline' | 'repo' | 'context7' | 'feedback'
  confidence?: number
}

export interface ExtractedAntiPattern {
  issue: string
  file: string
  suggestion: string
  severity?: 'low' | 'medium' | 'high'
  language?: string
  framework?: string
  source: 'baseline' | 'repo' | 'context7' | 'feedback'
  confidence?: number
}

export interface ExtractPatternInput {
  projectId: string
  projectPath: string
  languages: string[]
  frameworks: string[]
  feedback?: {
    patternsDiscovered: string[]
    knownGotchas: string[]
  }
  context7Verified: boolean
}

export interface ExtractPatternResult {
  patterns: ExtractedPattern[]
  antiPatterns: ExtractedAntiPattern[]
  repoPathHash: string
}

// --- Context7 Service Types ---

export interface Context7Status {
  installed: boolean
  verified: boolean
  configPath: string
  message?: string
}

// --- File Scorer Types ---

export interface FileScore {
  path: string
  score: number
  factors: {
    recency: number // 0-20
    centrality: number // 0-25
    configRelevance: number // 0-20
    nameRelevance: number // 0-15
    sizeOptimal: number // 0-10
    gitActivity: number // 0-10
  }
}

export interface FileStats {
  path: string
  size: number // bytes
  mtime: Date // modification time
  lines?: number // line count
  imports?: string[] // files this imports
  importedBy?: string[] // files that import this
  recentCommits?: number // commits in last 30 days
}

export interface ScoringContext {
  allFiles: Map<string, FileStats>
  configFiles: Set<string>
  maxFileSize: number
  maxRecentCommits: number
  now: Date
}

// --- Staleness Checker Types ---

export interface StalenessStatus {
  isStale: boolean
  reason: string | null
  lastSyncCommit: string | null
  currentCommit: string | null
  commitsSinceSync: number
  daysSinceSync: number
  changedFiles: string[]
  significantChanges: string[] // Files that likely affect context (package.json, etc.)
}

export interface StalenessConfig {
  commitThreshold: number // Number of commits before considered stale (default: 10)
  dayThreshold: number // Days before considered stale (default: 3)
  significantFiles: string[] // Files that trigger staleness warning
}

// --- Sync Agent Gen / Agent Generator Types ---

/** Task feedback context for agent generation (PRJ-272) */
export interface TaskFeedbackContext {
  patternsDiscovered: string[]
  knownGotchas: string[]
  agentAccuracy: Array<{ agent: string; rating: string; note?: string }>
}

// --- Git Analyzer Types ---

export interface GitData {
  branch: string
  commits: number
  contributors: number
  hasChanges: boolean
  stagedFiles: string[]
  modifiedFiles: string[]
  untrackedFiles: string[]
  recentCommits: { hash: string; message: string; date: string }[]
  weeklyCommits: number
}

// --- Agent Generator Types ---

export interface AgentInfo {
  name: string
  type: 'workflow' | 'domain'
  skill?: string
}

export interface ProjectStats {
  fileCount: number
  version: string
  name: string
  ecosystem: string
  projectType: string
  languages: string[]
  frameworks: string[]
}

// --- Dependency Validator Types ---

export interface ToolDefinition {
  name: string
  command: string // Command to check availability (e.g., 'git --version')
  versionRegex?: RegExp // Regex to extract version from output
  required: boolean // If false, missing tool is a warning, not error
  installHint: string // How to install if missing
  docs?: string // Documentation URL
}

export interface ToolStatus {
  available: boolean
  version?: string
  error?: import('./errors.js').ErrorWithHint
}

// --- Project Index Types ---

export interface IndexOptions {
  forceFullScan?: boolean // Force full scan even if index exists
  maxFiles?: number // Limit number of files to scan (for large repos)
  excludePatterns?: string[] // Additional patterns to exclude
}

export interface ScanResult {
  index: import('./storage.js').ProjectIndex
  fromCache: boolean
  changedFiles: number
  scanDuration: number
}

export interface RelevantContext {
  files: import('./storage.js').ScoredFile[]
  estimatedTokens: number
  originalTokens: number
  compressionRate: number
}

// --- Generated Skill Types (Native Claude Code Skills) ---

/** A workflow skill auto-generated by sync and installed to ~/.claude/skills/ */
export interface GeneratedSkill {
  /** Skill name (e.g., 'prjct-task', 'prjct-ship') */
  name: string
  /** Short description for frontmatter */
  description: string
  /** Full SKILL.md content (frontmatter + body) */
  content: string
  /** Installation path (e.g., ~/.claude/skills/prjct-task/SKILL.md) */
  path: string
}

/** Result of skill generation during sync */
export interface SkillGenerationResult {
  /** Skills that were generated and installed */
  generated: { name: string; path: string }[]
  /** Skills skipped because conditions not met */
  skipped: { name: string; reason: string }[]
}

// --- Skill Lock Types ---

export interface SkillLockSource {
  type: 'github' | 'local' | 'registry'
  url: string
  sha?: string
}

export interface SkillLockEntry {
  name: string
  source: SkillLockSource
  installedAt: string
  filePath: string
}

export interface SkillLockFile {
  version: 1
  generatedAt: string
  skills: Record<string, SkillLockEntry>
}

// --- Session Tracker Types ---

export interface CommandRecord {
  command: string
  timestamp: string
  durationMs: number
}

export interface FileRecord {
  path: string
  operation: 'read' | 'write'
  timestamp: string
}

export interface SessionData {
  id: string
  projectId: string
  status: 'active' | 'expired'
  createdAt: string
  lastActivity: string
  commands: CommandRecord[]
  files: FileRecord[]
}

export interface SessionFile {
  current: SessionData | null
  config: {
    idleTimeoutMs: number
  }
}

export interface SessionInfo {
  active: boolean
  id: string | null
  duration: string | null
  idleSince: string | null
  idleMs: number
  expiresIn: string | null
  commandCount: number
  commands: string[]
  filesRead: number
  filesWritten: number
}

// --- Nested Context Resolver Types ---

export interface NestedContext {
  /** Absolute path to the PRJCT.md file */
  path: string
  /** Relative path from monorepo root */
  relativePath: string
  /** Depth in the directory tree (0 = root) */
  depth: number
  /** Parent context (null for root) */
  parent: NestedContext | null
  /** Child contexts */
  children: NestedContext[]
  /** Raw content of the PRJCT.md file */
  content: string
  /** Parsed sections from the PRJCT.md */
  sections: ContextSection[]
  /** Associated package info (if in a monorepo package) */
  package: import('./infrastructure.js').MonorepoPackage | null
}

export interface ContextSection {
  /** Section name (e.g., "Rules", "Patterns", "Stack") */
  name: string
  /** Section content */
  content: string
  /** Whether this section should override parent */
  override: boolean
}

export interface ResolvedContext {
  /** The final merged content */
  content: string
  /** Sources that contributed to this context (from root to leaf) */
  sources: string[]
  /** Sections that were overridden */
  overrides: string[]
}

export interface AgentDefinition {
  /** Agent name (e.g., "frontend", "backend", "database") */
  name: string
  /** Description of what this agent handles */
  description: string
  /** Domain this agent specializes in */
  domain?: string
  /** Trigger phrases that activate this agent */
  triggers?: string[]
  /** Rules/guidelines for this agent */
  rules?: string[]
  /** Code patterns this agent follows */
  patterns?: string[]
  /** Example interactions */
  examples?: string[]
  /** Whether this agent overrides parent definition */
  override?: boolean
}

export interface NestedAgents {
  /** Absolute path to the AGENTS.md file */
  path: string
  /** Relative path from monorepo root */
  relativePath: string
  /** Depth in the directory tree (0 = root) */
  depth: number
  /** Parent agents file (null for root) */
  parent: NestedAgents | null
  /** Child agents files */
  children: NestedAgents[]
  /** Raw content of the AGENTS.md file */
  content: string
  /** Parsed agent definitions */
  agents: AgentDefinition[]
  /** Associated package info (if in a monorepo package) */
  package: import('./infrastructure.js').MonorepoPackage | null
}

export interface ResolvedAgents {
  /** The merged agent definitions (deeper overrides shallower) */
  agents: AgentDefinition[]
  /** Sources that contributed to these agents (from root to leaf) */
  sources: string[]
  /** Agents that were overridden */
  overrides: string[]
}

// --- Skill Installer Types ---

export interface ParsedSource {
  type: 'github' | 'local'
  owner?: string
  repo?: string
  skillName?: string
  localPath?: string
  url: string
}

export interface InstalledSkill {
  name: string
  filePath: string
  source: ParsedSource
  sha?: string
}

export interface InstallResult {
  installed: InstalledSkill[]
  skipped: string[]
  errors: string[]
}

// --- File Categorizer Types ---

export interface CategorizationResult {
  domains: import('./storage.js').DomainDefinition[]
  categories: import('./storage.js').FileCategory[]
  metrics: {
    totalFiles: number
    categorizedFiles: number
    domainsDiscovered: number
    llmCalls: number
    usedHeuristics: boolean
  }
}

export interface CategorizationOptions {
  batchSize?: number // Files per LLM call (default: 20)
  maxDomains?: number // Max domains to discover (default: 15)
  useLLM?: boolean // Use LLM or heuristics only (default: true)
  projectId?: string // For caching
}

// --- Changelog Service Types ---

export type ChangelogFormat = 'keepachangelog' | 'markdown'

export interface ChangelogDetection {
  /** Absolute path to the detected changelog file */
  filePath: string
  /** Filename (e.g. "CHANGELOG.md") */
  fileName: string
  /** Detected format */
  format: ChangelogFormat
  /** Whether the file already existed or was created */
  created: boolean
}

export interface ChangelogEntry {
  version: string
  date?: string
  sections?: Record<string, string[]>
  description?: string
}

// --- Task Estimation Types ---

export interface TaskEstimate {
  taskType: 'feature' | 'bug' | 'improvement' | 'chore'
  estimatedPoints: import('./domain.js').FibonacciPoint
  estimatedMinutes: number
  source: 'history' | 'heuristic'
}

// --- Context Selector Types ---

export interface SelectedContext {
  files: import('./storage.js').ScoredFile[]
  domains: string[]
  metrics: {
    totalFiles: number
    selectedFiles: number
    compressionRate: number
    estimatedTokensSaved: number
  }
}

export interface ContextSelectionOptions {
  maxFiles?: number // Max files to return (default: 50)
  minScore?: number // Min relevance score (default: 30)
  includeGeneral?: boolean // Include 'general' domain files (default: true)
  tokenBudget?: number // Max estimated tokens (default: 80000, or from coordinator)
}

// --- Hooks Service Types ---

export type HookStrategy = 'lefthook' | 'husky' | 'direct'
export type HookName = 'post-commit' | 'post-checkout'

// --- Analysis Diff Types ---

export interface AnalysisDiffItem {
  field: string
  type: 'added' | 'removed' | 'changed'
  before?: string
  after?: string
}

export interface AnalysisDiff {
  hasChanges: boolean
  items: AnalysisDiffItem[]
  summary: {
    added: number
    removed: number
    changed: number
  }
  beforeCommit: string | null
  afterCommit: string | null
}

// --- Version Service Types ---

export type VersionFormat = 'json' | 'toml' | 'xml' | 'plaintext' | 'git-tag'

export interface VersionInfo {
  current: string
  next: string
  file: string | null
  format: VersionFormat
}

// --- Doctor Service Types ---

export interface CheckResult {
  name: string
  status: 'ok' | 'warn' | 'error'
  version?: string
  message?: string
  optional?: boolean
}

export interface DoctorResult {
  success: boolean
  tools: CheckResult[]
  project: CheckResult[]
  recommendations: string[]
  hasErrors: boolean
  hasWarnings: boolean
}
