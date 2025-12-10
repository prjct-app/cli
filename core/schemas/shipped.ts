/**
 * Shipped Schema
 *
 * Defines the structure for shipped.json - completed/shipped items.
 * ZERO DATA LOSS - captures ALL fields from MD files.
 */

export type ShipType = 'feature' | 'fix' | 'improvement' | 'refactor'
export type CheckStatus = 'pass' | 'warning' | 'fail' | 'skipped'
export type AgentType = 'fe' | 'be' | 'fe+be' | 'devops' | 'ai' | string

// Duration object for parsed time strings like "13h 38m"
export interface Duration {
  hours: number
  minutes: number
  totalMinutes: number
}

// Code metrics from "Files: 4 | +160/-31 | Commits: 0"
export interface CodeMetrics {
  filesChanged?: number | null
  linesAdded?: number | null
  linesRemoved?: number | null
  commits?: number | null
}

export interface ShipChange {
  description: string
  type?: 'added' | 'changed' | 'fixed' | 'removed'
}

export interface QualityMetrics {
  lintStatus?: CheckStatus | null
  lintDetails?: string
  testStatus?: CheckStatus | null
  testDetails?: string
}

// Git commit information
export interface CommitInfo {
  hash?: string                 // "0a7bbea"
  message?: string              // "feat(security): Multi-tenant..."
  branch?: string               // "main"
}

export interface ShippedItemSchema {
  id: string                    // ship_xxxxxxxx
  name: string
  version?: string | null       // "0.11.6" extracted from MD
  type: ShipType
  // Agent who worked on this
  agent?: AgentType             // "fe+be", "be", "fe"
  // Full description (narrative text, not just bullet points)
  description?: string          // "CRITICAL: Multi-tenant isolation hardening..."
  // Changelog from bullet points
  changes: ShipChange[]
  // Code snippets if any
  codeSnippets?: string[]       // TypeScript/code examples from MD
  // Git commit info
  commit?: CommitInfo
  // Enriched fields from MD
  codeMetrics?: CodeMetrics
  qualityMetrics?: QualityMetrics
  quantitativeImpact?: string   // "81% (1,079 → 204 lines)"
  duration?: Duration           // parsed from "13h 38m"
  tasksCompleted?: number | null
  shippedAt: string             // ISO8601
  featureId?: string
}

export interface ShippedJson {
  items: ShippedItemSchema[]
  lastUpdated: string
}

// Legacy type for backwards compatibility
export type ShippedSchema = ShippedItemSchema[]

export const DEFAULT_SHIPPED: ShippedJson = {
  items: [],
  lastUpdated: ''
}
