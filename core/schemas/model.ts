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

// Provider-Specific Model Identifiers

// Supported Models Per Provider

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

// Minimum CLI Versions

const MIN_CLI_VERSIONS: Record<string, string> = {
  claude: '1.0.0',
  gemini: '1.0.0',
} as const

// Agent Model Policy — per-role model + effort for subagent dispatch

/**
 * Which Claude model + how much reasoning effort each subagent ROLE gets.
 *
 * Perf rationale: every subagent used to inherit the parent session's max
 * model + max effort. Orchestrators and reviewers don't implement — they
 * route and judge — so running them on Opus-max made every task's agent
 * fan-out crawl. Only the implementer needs full max.
 *
 *  - implementer   → opus  / max    (writes code, needs the best model)
 *  - orchestrator  → haiku / decent (crew leader: decomposes & routes only)
 *  - reviewer tier → sonnet / decent (audit-spec's 3 reviewers + audit/
 *                                     review/security/investigate + crew
 *                                     reviewer: judgment, strong reasoning
 *                                     but not Opus-max)
 *
 * `effort` is GUIDANCE inlined into the dispatch prompt (the Agent tool has
 * no per-call effort param) — "decent, not exhaustive: you orchestrate/
 * review, return the verdict, don't over-deliberate". `model` is the
 * concrete lever the orchestrator passes to the Agent tool.
 */
export type AgentRole =
  | 'implementer'
  | 'orchestrator'
  | 'strategic-review'
  | 'architecture-review'
  | 'design-review'
  | 'spec-review'
  | 'review'
  | 'security'
  | 'investigate'
  | 'reviewer'

export type AgentModelTier = 'opus' | 'sonnet' | 'haiku'
export type AgentEffort = 'max' | 'decent'

export interface AgentModelPolicy {
  model: AgentModelTier
  effort: AgentEffort
}

const IMPLEMENTER_POLICY: AgentModelPolicy = { model: 'opus', effort: 'max' }
const ORCHESTRATOR_POLICY: AgentModelPolicy = { model: 'haiku', effort: 'decent' }
const REVIEWER_POLICY: AgentModelPolicy = { model: 'sonnet', effort: 'decent' }

export const AGENT_MODEL_POLICY: Record<AgentRole, AgentModelPolicy> = {
  implementer: IMPLEMENTER_POLICY,
  orchestrator: ORCHESTRATOR_POLICY,
  'strategic-review': REVIEWER_POLICY,
  'architecture-review': REVIEWER_POLICY,
  'design-review': REVIEWER_POLICY,
  'spec-review': REVIEWER_POLICY,
  review: REVIEWER_POLICY,
  security: REVIEWER_POLICY,
  investigate: REVIEWER_POLICY,
  reviewer: REVIEWER_POLICY,
}

/**
 * Policy for a role. Unknown roles default to the reviewer tier — never
 * silently fall back to implementer/max (that is the regression we are
 * fixing).
 */
export function getAgentModelPolicy(role: AgentRole): AgentModelPolicy {
  return AGENT_MODEL_POLICY[role] ?? REVIEWER_POLICY
}

/**
 * Rig sovereignty: graceful degradation when the preferred tier is throttled
 * or unavailable. For each tier, the ordered list of tiers to try — the
 * preferred one first, then the nearest still-capable option. The brain is
 * rented and can be pulled; the harness keeps working on whatever tier is
 * available rather than failing. Reviewer/orchestrator prefer to degrade
 * CHEAPER first (cost discipline); the implementer degrades by capability.
 */
export const MODEL_TIER_FALLBACK: Record<AgentModelTier, readonly AgentModelTier[]> = {
  opus: ['opus', 'sonnet', 'haiku'],
  sonnet: ['sonnet', 'haiku', 'opus'],
  haiku: ['haiku', 'sonnet', 'opus'],
}

export interface ResolvedAgentModel extends AgentModelPolicy {
  /** The tier the role would use with no constraints. */
  preferred: AgentModelTier
  /** True when the preferred tier was unavailable and we degraded. */
  degraded: boolean
}

/**
 * Resolve the tier a role should actually dispatch with, given the set of
 * currently-available tiers (e.g. derived from the active provider). Walks the
 * role's fallback chain and returns the first available tier. When `available`
 * is empty/unknown we assume the preferred tier is usable (no info → don't
 * degrade). Effort is unchanged by degradation — a weaker tier needs its full
 * effort budget more, not less.
 */
export function resolveAgentModel(
  role: AgentRole,
  available?: ReadonlySet<AgentModelTier>
): ResolvedAgentModel {
  const policy = getAgentModelPolicy(role)
  if (!available || available.size === 0) {
    return { ...policy, preferred: policy.model, degraded: false }
  }
  for (const tier of MODEL_TIER_FALLBACK[policy.model]) {
    if (available.has(tier)) {
      return { ...policy, model: tier, preferred: policy.model, degraded: tier !== policy.model }
    }
  }
  // No tier in the chain is available — keep the preferred as a last resort.
  return { ...policy, preferred: policy.model, degraded: false }
}

/**
 * One-line directive to inline into a subagent dispatch prompt so the
 * orchestrator passes the right `model:` to the Agent tool and the subagent
 * calibrates its effort. Implementer keeps max; every other role is told,
 * explicitly, to go smaller + decent.
 *
 * Pass `available` (the tiers the active rig can currently dispatch) to make
 * the directive degrade gracefully when the preferred tier is throttled —
 * the multi-agent fan-out keeps running on the best available brain instead
 * of failing. Omit it and the directive is byte-identical to the original.
 */
export function renderModelDirective(
  role: AgentRole,
  available?: ReadonlySet<AgentModelTier>
): string {
  const r = resolveAgentModel(role, available)
  const isImplementer = r.preferred === 'opus' && r.effort === 'max'
  if (isImplementer && !r.degraded) {
    return 'Dispatch with the Agent tool using `model: "opus"` and full reasoning effort — this is the IMPLEMENTER; it writes code and needs the best model.'
  }
  if (isImplementer) {
    return `Dispatch with the Agent tool using \`model: "${r.model}"\` — this is the IMPLEMENTER, but its preferred tier \`opus\` is unavailable/throttled, so it is degraded to \`${r.model}\` at full effort. Compensate by leaning harder on verification (\`verify:\` gates) before ship.`
  }
  const base = `Dispatch with the Agent tool using \`model: "${r.model}"\` (NOT the parent's max model). Apply ${r.effort}, not exhaustive, effort — this is an orchestration/review role: return the verdict, don't over-deliberate. A smaller model at decent effort is correct here and far faster.`
  return r.degraded
    ? `${base} (Preferred tier \`${r.preferred}\` is unavailable/throttled — degraded to \`${r.model}\`.)`
    : base
}

// Model Metadata - Recorded Per Operation

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

// Model Configuration - Per Project

// Inferred Types

export type ModelMetadata = z.infer<typeof ModelMetadataSchema>

// Validation Helpers

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
