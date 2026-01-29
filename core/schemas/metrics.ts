/**
 * Metrics Schema
 *
 * Defines the structure for metrics.json - value dashboard metrics.
 * Tracks token savings, sync performance, and usage trends.
 *
 * Uses Zod for runtime validation and TypeScript type inference.
 * @version 1.0.0
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas - Source of Truth
// =============================================================================

/**
 * Daily stats for trend analysis
 */
export const DailyStatsSchema = z.object({
  date: z.string(),                    // YYYY-MM-DD
  tokensSaved: z.number(),             // Tokens saved that day
  syncs: z.number(),                   // Number of syncs
  avgCompressionRate: z.number(),      // Average compression rate (0-1)
  totalDuration: z.number(),           // Total sync time in ms
})

/**
 * Agent usage tracking
 */
export const AgentUsageSchema = z.object({
  agentName: z.string(),               // e.g., "backend", "frontend"
  usageCount: z.number(),              // Times invoked
  tokensSaved: z.number(),             // Tokens saved by this agent
})

/**
 * Main metrics JSON structure
 */
export const MetricsJsonSchema = z.object({
  // Token metrics
  totalTokensSaved: z.number(),
  avgCompressionRate: z.number(),      // 0-1 (e.g., 0.63 = 63% reduction)

  // Sync metrics
  syncCount: z.number(),
  watchTriggers: z.number(),           // Auto-syncs from watch mode
  avgSyncDuration: z.number(),         // Average in ms
  totalSyncDuration: z.number(),       // Total in ms

  // Agent usage
  agentUsage: z.array(AgentUsageSchema),

  // Time series for trends
  dailyStats: z.array(DailyStatsSchema),

  // Metadata
  firstSync: z.string(),               // ISO8601 - when tracking started
  lastUpdated: z.string(),             // ISO8601
})

// =============================================================================
// Inferred Types
// =============================================================================

export type DailyStats = z.infer<typeof DailyStatsSchema>
export type AgentUsage = z.infer<typeof AgentUsageSchema>
export type MetricsJson = z.infer<typeof MetricsJsonSchema>

// =============================================================================
// Validation Helpers
// =============================================================================

/** Parse and validate metrics.json content */
export const parseMetrics = (data: unknown): MetricsJson => MetricsJsonSchema.parse(data)

/** Safe parse with error result */
export const safeParseMetrics = (data: unknown) => MetricsJsonSchema.safeParse(data)

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_METRICS: MetricsJson = {
  totalTokensSaved: 0,
  avgCompressionRate: 0,
  syncCount: 0,
  watchTriggers: 0,
  avgSyncDuration: 0,
  totalSyncDuration: 0,
  agentUsage: [],
  dailyStats: [],
  firstSync: '',
  lastUpdated: '',
}

// =============================================================================
// Cost Calculation Constants (January 2026 Pricing)
// =============================================================================

/**
 * Token costs per 1000 tokens (INPUT pricing)
 * Source: https://docs.anthropic.com/en/docs/about-claude/models
 *
 * Used for estimating cost savings from context compression
 */
export const TOKEN_COSTS = {
  // Current models (2026)
  'claude-opus-4.5': 0.005,      // $5/M input - flagship
  'claude-sonnet-4.5': 0.003,    // $3/M input - balanced
  'claude-haiku-4.5': 0.001,     // $1/M input - fastest
  // Legacy models
  'claude-opus-4': 0.015,        // $15/M input
  'claude-sonnet-4': 0.003,      // $3/M input
  'claude-3-opus': 0.015,        // $15/M input (deprecated)
  'claude-3-sonnet': 0.003,      // $3/M input (deprecated)
  // Other providers
  'gpt-4o': 0.0025,              // $2.50/M input
  'gpt-4': 0.01,                 // $10/M input (legacy)
  'gemini-pro': 0.00125,         // $1.25/M input
  // Default: Claude Sonnet (most common for Claude Code)
  default: 0.003,                // $3/M input
} as const

export type ModelName = keyof typeof TOKEN_COSTS

/**
 * Calculate estimated cost saved based on tokens
 */
export function estimateCostSaved(tokens: number, model: ModelName = 'default'): number {
  const costPer1k = TOKEN_COSTS[model] || TOKEN_COSTS.default
  return (tokens / 1000) * costPer1k
}

/**
 * Format cost as currency string
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(2)}¢`
  }
  return `$${cost.toFixed(2)}`
}
