/**
 * Zod schema mirroring `core/types/llm-analysis.ts`.
 *
 * Used by `prjct analysis-save-llm` (and any caller persisting LLM
 * output) to validate the payload BEFORE it lands in SQLite. The
 * previous validation was a three-field truthy check
 * (`!analysis.version || !analysis.architecture || !analysis.patterns`),
 * which let through structurally-broken payloads (e.g. `architecture`
 * as a string, `patterns` as a number) that broke the wiki-generator
 * downstream when it tried to iterate fields that weren't arrays.
 *
 * The schema accepts unknown extra keys (`.passthrough()` would defeat
 * the purpose) but enforces the shape for every field we actually
 * read.
 */

import { z } from 'zod'

const ArchitectureInsightSchema = z.object({
  style: z.string(),
  insights: z.array(z.string()),
  domains: z.array(z.string()),
})

const LLMPatternSchema = z.object({
  name: z.string(),
  description: z.string(),
  locations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  category: z.string(),
})

const LLMAntiPatternSchema = z.object({
  issue: z.string(),
  reasoning: z.string(),
  files: z.array(z.string()),
  suggestion: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  confidence: z.number().min(0).max(1),
})

const TechDebtItemSchema = z.object({
  description: z.string(),
  area: z.string(),
  effort: z.enum(['small', 'medium', 'large']),
  impact: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
})

const RiskAreaSchema = z.object({
  path: z.string(),
  reason: z.string(),
  risk: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
})

const RefactorSuggestionSchema = z.object({
  description: z.string(),
  files: z.array(z.string()),
  benefit: z.string(),
  effort: z.enum(['small', 'medium', 'large']),
})

const ConventionSchema = z.object({
  category: z.string(),
  rule: z.string(),
  example: z.string().optional(),
})

const CommandsSchema = z.object({
  build: z.string().optional(),
  test: z.string().optional(),
  lint: z.string().optional(),
  dev: z.string().optional(),
  format: z.string().optional(),
  install: z.string().optional(),
})

const StackSchema = z.object({
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  packageManager: z.string().optional(),
})

export const LLMAnalysisSchema = z.object({
  version: z.literal(1),
  commitHash: z.string().nullable(),
  analyzedAt: z.string(),
  architecture: ArchitectureInsightSchema,
  patterns: z.array(LLMPatternSchema),
  antiPatterns: z.array(LLMAntiPatternSchema),
  techDebt: z.array(TechDebtItemSchema),
  riskAreas: z.array(RiskAreaSchema),
  refactorSuggestions: z.array(RefactorSuggestionSchema),
  projectInsights: z.array(z.string()),
  conventions: z.array(ConventionSchema),
  commands: CommandsSchema.optional(),
  stack: StackSchema.optional(),
})

/**
 * `safeParse` wrapper that returns either the validated payload or a
 * formatted error string (no exceptions). Caller decides whether to
 * surface the error to the user via the CLI's normal `success/error`
 * envelope.
 */
export function parseLlmAnalysis(
  data: unknown
): { ok: true; value: z.infer<typeof LLMAnalysisSchema> } | { ok: false; error: string } {
  const result = LLMAnalysisSchema.safeParse(data)
  if (result.success) return { ok: true, value: result.data }
  // Flatten zod's nested issue tree into a single readable line per error
  // so the LLM sees actionable feedback ("patterns.0.confidence: expected
  // number, received string") instead of the full ZodError dump.
  const messages = result.error.issues.map((i) => {
    const path = i.path.length > 0 ? i.path.join('.') : '<root>'
    return `${path}: ${i.message}`
  })
  return { ok: false, error: messages.join('; ') }
}
