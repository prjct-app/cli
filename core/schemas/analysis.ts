/**
 * Analysis Schema
 *
 * Defines the structure for analysis.json - repository analysis.
 * Supports a 3-state lifecycle: DRAFT → VERIFIED → SEALED (PRJ-263).
 */

import { z } from 'zod'
import { ModelMetadataSchema } from './model'

// =============================================================================
// Zod Schemas - Source of Truth
// =============================================================================

export const AnalysisStatusSchema = z.enum(['draft', 'verified', 'sealed'])

export const CodePatternSchema = z.object({
  name: z.string(),
  description: z.string(),
  location: z.string().optional(),
})

export const AntiPatternSchema = z.object({
  issue: z.string(),
  file: z.string(),
  suggestion: z.string(),
})

export const AnalysisItemSchema = z.object({
  projectId: z.string(),
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  packageManager: z.string().optional(),
  sourceDir: z.string().optional(),
  testDir: z.string().optional(),
  configFiles: z.array(z.string()),
  fileCount: z.number(),
  patterns: z.array(CodePatternSchema),
  antiPatterns: z.array(AntiPatternSchema),
  analyzedAt: z.string(), // ISO8601
  /** Which AI model was used for this analysis (PRJ-265) */
  modelMetadata: ModelMetadataSchema.optional(),

  // Sealable analysis fields (PRJ-263)
  /** Lifecycle status: draft (regenerable), verified (confirmed correct), sealed (locked) */
  status: AnalysisStatusSchema.default('draft'),
  /** Git commit hash at the time of analysis */
  commitHash: z.string().optional(),
  /** SHA-256 signature of analysis content + commit hash */
  signature: z.string().optional(),
  /** When the analysis was sealed */
  sealedAt: z.string().optional(), // ISO8601
  /** When the analysis was verified */
  verifiedAt: z.string().optional(), // ISO8601
})

// =============================================================================
// Inferred Types - Backward Compatible
// =============================================================================

export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>
export type CodePattern = z.infer<typeof CodePatternSchema>
export type AntiPattern = z.infer<typeof AntiPatternSchema>
/** Use z.input so optional fields with defaults (like status) remain optional in creation */
export type AnalysisSchema = z.input<typeof AnalysisItemSchema>

// =============================================================================
// Validation Helpers
// =============================================================================

/** Parse and validate analysis.json content */
export const parseAnalysis = (data: unknown): z.infer<typeof AnalysisItemSchema> =>
  AnalysisItemSchema.parse(data)
export const safeParseAnalysis = (data: unknown) => AnalysisItemSchema.safeParse(data)

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_ANALYSIS: Omit<AnalysisSchema, 'projectId'> = {
  languages: [],
  frameworks: [],
  configFiles: [],
  fileCount: 0,
  patterns: [],
  antiPatterns: [],
  analyzedAt: new Date().toISOString(),
  status: 'draft',
}
