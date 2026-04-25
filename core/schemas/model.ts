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

// =============================================================================
// Supported Models Per Provider
// =============================================================================

const SUPPORTED_MODELS: Record<string, readonly string[]> = {
  claude: ['opus', 'sonnet', 'haiku'],
  gemini: ['2.5-pro', '2.5-flash', '2.0-flash'],
  cursor: [], // Multi-model IDE, user selects model
  windsurf: [], // Multi-model IDE, user selects model
  antigravity: [], // Platform-managed
} as const

const DEFAULT_MODELS: Record<string, string> = {
  claude: 'sonnet',
  gemini: '2.5-flash',
} as const

// =============================================================================
// Minimum CLI Versions
// =============================================================================

const MIN_CLI_VERSIONS: Record<string, string> = {
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

// =============================================================================
// Inferred Types
// =============================================================================

export type ModelMetadata = z.infer<typeof ModelMetadataSchema>

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
