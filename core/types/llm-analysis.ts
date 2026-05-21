/**
 * LLM Analysis Types
 *
 * Structured findings produced by the LLM during hybrid sync.
 * The CLI builds a compact payload, the active agent analyzes it,
 * and the CLI stores the structured result in SQLite.
 *
 * Pipeline: CLI (collect) → LLM (analyze) → CLI (store)
 */

// LLM Analysis Result (what the LLM produces)

export interface LLMAnalysis {
  /** Schema version for forward compatibility */
  version: 1

  /** Git commit hash at time of analysis */
  commitHash: string | null

  /** ISO timestamp of when the analysis was performed */
  analyzedAt: string

  // Architecture
  architecture: ArchitectureInsight

  // Code quality
  patterns: LLMPattern[]
  antiPatterns: LLMAntiPattern[]
  techDebt: TechDebtItem[]

  // Predictions
  riskAreas: RiskArea[]
  refactorSuggestions: RefactorSuggestion[]

  // Knowledge
  projectInsights: string[]
  conventions: Convention[]

  // Stack & commands (optional for backward compat with existing analyses)
  commands?: {
    build?: string
    test?: string
    lint?: string
    dev?: string
    format?: string
    install?: string
  }
  stack?: {
    languages: string[]
    frameworks: string[]
    packageManager?: string
  }
}

export interface ArchitectureInsight {
  /** e.g. "monorepo", "monolith", "microservices", "modular-monolith" */
  style: string
  /** Key architectural observations */
  insights: string[]
  /** Main domains/modules identified */
  domains: string[]
}

export interface LLMPattern {
  name: string
  description: string
  /** Files where this pattern is observed */
  locations: string[]
  /** How confident the LLM is (0-1) */
  confidence: number
  /** e.g. "architecture", "data-flow", "error-handling", "testing" */
  category: string
}

export interface LLMAntiPattern {
  issue: string
  /** Why this is problematic */
  reasoning: string
  /** Affected files */
  files: string[]
  /** Actionable fix */
  suggestion: string
  severity: 'low' | 'medium' | 'high'
  confidence: number
}

export interface TechDebtItem {
  description: string
  /** Affected area (module, file, or system) */
  area: string
  /** Estimated effort: "small" (<1h), "medium" (1-4h), "large" (4h+) */
  effort: 'small' | 'medium' | 'large'
  /** Business impact if not addressed */
  impact: string
  priority: 'low' | 'medium' | 'high'
}

export interface RiskArea {
  /** File or module path */
  path: string
  /** Why this area is risky */
  reason: string
  /** What could go wrong */
  risk: string
  severity: 'low' | 'medium' | 'high'
}

export interface RefactorSuggestion {
  description: string
  /** Files to refactor */
  files: string[]
  /** Expected benefit */
  benefit: string
  effort: 'small' | 'medium' | 'large'
}

export interface Convention {
  /** e.g. "naming", "file-structure", "imports", "error-handling" */
  category: string
  /** The convention rule */
  rule: string
  /** Example from the codebase */
  example?: string
}

// Analysis Payload (what CLI sends to LLM)

export interface AnalysisPayload {
  /** Project metadata */
  project: {
    name: string
    ecosystem: string
    languages: string[]
    frameworks: string[]
    fileCount: number
    projectType: string
  }

  /** Git context */
  git: {
    branch: string
    recentCommits: { message: string; date: string }[]
    hasChanges: boolean
    weeklyCommits: number
  }

  /** Top files by importance (BM25 scored) */
  codeSamples: {
    path: string
    content: string
    /** Why this file was selected */
    reason: string
  }[]

  /** Existing heuristic-detected patterns */
  existingPatterns: {
    patterns: { name: string; description: string }[]
    antiPatterns: { issue: string; file: string; suggestion: string }[]
  }

  /** Recent task history */
  taskHistory: {
    description: string
    status: string
    branch?: string
  }[]

  /** Previous LLM analysis summary (for delta) */
  previousAnalysis?: {
    commitHash: string | null
    architectureStyle: string
    patternCount: number
    antiPatternCount: number
    analyzedAt: string
  }
}
