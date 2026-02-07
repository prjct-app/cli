/**
 * Response Validator
 *
 * Validates LLM responses against Zod schemas.
 * Provides structured error handling with re-prompt support.
 *
 * Flow:
 * 1. Parse raw text as JSON
 * 2. Validate against Zod schema
 * 3. On success: return typed data
 * 4. On failure: return validation errors for re-prompt or fallback
 *
 * @see PRJ-264
 */

import type { z } from 'zod'

// =============================================================================
// Types
// =============================================================================

export interface ValidationSuccess<T> {
  success: true
  data: T
}

export interface ValidationFailure {
  success: false
  error: string
  /** Raw parsed JSON (may be partial) */
  rawParsed: unknown
  /** Zod validation issues */
  issues: string[]
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

// =============================================================================
// Core Validation
// =============================================================================

/**
 * Validate a raw LLM response string against a Zod schema.
 *
 * Handles:
 * - JSON parse errors (LLM returned non-JSON)
 * - Markdown-wrapped JSON (```json ... ```)
 * - Schema validation errors (wrong fields, types)
 */
export function validateLLMResponse<T>(raw: string, schema: z.ZodType<T>): ValidationResult<T> {
  // Strip markdown code fences if present
  let jsonText = raw.trim()
  const fenceMatch = jsonText.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim()
  }

  // Attempt JSON parse
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return {
      success: false,
      error: 'Response is not valid JSON',
      rawParsed: null,
      issues: [`JSON parse error: expected JSON, got: ${jsonText.slice(0, 100)}...`],
    }
  }

  // Validate against schema
  const result = schema.safeParse(parsed)
  if (result.success) {
    return { success: true, data: result.data }
  }

  // Extract readable error messages
  const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)

  return {
    success: false,
    error: `Schema validation failed: ${issues.join('; ')}`,
    rawParsed: parsed,
    issues,
  }
}

/**
 * Build a re-prompt message when validation fails.
 * Includes the original error so the LLM can fix its response.
 */
export function buildReprompt(failure: ValidationFailure, schemaExample: string): string {
  return `Your previous response was not valid. Errors:
${failure.issues.map((i) => `- ${i}`).join('\n')}

Return ONLY valid JSON matching this exact format (no markdown, no explanation):
${schemaExample}`
}
