/**
 * Model Schema
 *
 * Defines model specification types for AI providers.
 * Records which model was used for each analysis and task,
 * enabling consistency tracking and mismatch warnings.
 *
 * @see PRJ-265
 */

import { z } from 'zod'

// =============================================================================
// Provider-Specific Model Identifiers
// =============================================================================

/** Claude model identifiers (short names matching agent frontmatter convention) */
export const ClaudeModelSchema = z.enum(['opus', 'sonnet', 'haiku'])

/** Gemini model identifiers */
export const GeminiModelSchema = z.enum(['2.5-pro', '2.5-flash', '2.0-flash'])

/** Generic model identifier - allows any string for future providers */
export const AIModelSchema = z.string().min(1)

// =============================================================================
// Supported Models Per Provider
// =============================================================================

export const SUPPORTED_MODELS: Record<string, readonly string[]> = {
  claude: ['opus', 'sonnet', 'haiku'],
  gemini: ['2.5-pro', '2.5-flash', '2.0-flash'],
  cursor: [], // Multi-model IDE, user selects model
  windsurf: [], // Multi-model IDE, user selects model
  antigravity: [], // Platform-managed
} as const

export const DEFAULT_MODELS: Record<string, string> = {
  claude: 'sonnet',
  gemini: '2.5-flash',
} as const

// =============================================================================
// Minimum CLI Versions
// =============================================================================

export const MIN_CLI_VERSIONS: Record<string, string> = {
  claude: '1.0.0',
  gemini: '1.0.0',
} as const

// =============================================================================
// Model Metadata - Recorded Per Operation
// =============================================================================

/** Model metadata recorded with each analysis or task */
export const ModelMetadataSchema = z.object({
  /** Provider name (e.g., 'claude', 'gemini') */
  provider: z.string(),
  /** Model identifier (e.g., 'opus', 'sonnet', '2.5-pro') */
  model: z.string(),
  /** CLI version used */
  cliVersion: z.string().optional(),
  /** When this was recorded */
  recordedAt: z.string(),
})

// =============================================================================
// Model Configuration - Per Project
// =============================================================================

/** Per-project model preference */
export const ModelPreferenceSchema = z.object({
  /** Preferred model for this project */
  preferredModel: z.string().optional(),
  /** Model used for last analysis (for mismatch detection) */
  lastAnalysisModel: ModelMetadataSchema.optional(),
})

// =============================================================================
// Inferred Types
// =============================================================================

export type ClaudeModel = z.infer<typeof ClaudeModelSchema>
export type GeminiModel = z.infer<typeof GeminiModelSchema>
export type ModelMetadata = z.infer<typeof ModelMetadataSchema>
export type ModelPreference = z.infer<typeof ModelPreferenceSchema>

// =============================================================================
// Validation Helpers
// =============================================================================

/** Check if a model is valid for a given provider */
export function isValidModelForProvider(provider: string, model: string): boolean {
  const supported = SUPPORTED_MODELS[provider]
  if (!supported || supported.length === 0) return true // No restriction for multi-model IDEs
  return supported.includes(model)
}

/** Get the default model for a provider */
export function getDefaultModel(provider: string): string | null {
  return DEFAULT_MODELS[provider] ?? null
}

/** Get supported models for a provider */
export function getSupportedModels(provider: string): readonly string[] {
  return SUPPORTED_MODELS[provider] ?? []
}

/** Get minimum CLI version for a provider */
export function getMinCliVersion(provider: string): string | null {
  return MIN_CLI_VERSIONS[provider] ?? null
}

/**
 * Compare semver versions. Returns:
 *  -1 if a < b
 *   0 if a == b
 *   1 if a > b
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va < vb) return -1
    if (va > vb) return 1
  }
  return 0
}

/** Check if a CLI version meets minimum requirements */
export function meetsMinVersion(provider: string, version: string): boolean {
  const min = MIN_CLI_VERSIONS[provider]
  if (!min) return true // No minimum defined
  return compareSemver(version, min) >= 0
}

/**
 * Check for model mismatch between analysis and current task.
 * Returns a warning message if the models differ, or null if they match.
 */
export function checkModelMismatch(
  analysisModel: ModelMetadata | undefined,
  taskModel: ModelMetadata | undefined
): string | null {
  if (!analysisModel || !taskModel) return null
  if (analysisModel.provider !== taskModel.provider || analysisModel.model !== taskModel.model) {
    return `⚠️ Model mismatch: analysis used ${analysisModel.provider}/${analysisModel.model}, but task is using ${taskModel.provider}/${taskModel.model}. Results may differ.`
  }
  return null
}
