/**
 * Owned-loop multi-brain types.
 *
 * Design:
 * - Profiles are machine-local, non-secret, mergeable by name.
 * - Secrets live only in secure-key (never global.json).
 * - Wires are pluggable; agent-core (later) only depends on LlmProvider.
 * - Guest mode (Claude/Grok/Codex/…) is untouched — this layer is for owned loop only.
 */

/** Wire protocol for a vendor / gateway. */
export type LlmWireKind = 'openai-compatible' | 'anthropic'

/**
 * Named machine-local brain profile (non-secret fields only).
 * Stable `name` is the join key for merge + key storage.
 */
export interface LlmProfile {
  /** Lowercase slug used by `prjct llm use <name>` and key account */
  name: string
  wire: LlmWireKind
  /** Human label: OpenAI, Ollama, OpenRouter, Anthropic, … */
  providerLabel: string
  baseUrl: string
  model: string
  /** Header carrying the key. Default `authorization` (OpenAI-compat). */
  authHeader?: string
  /** Scheme before the key. Default `Bearer`. Empty string = raw key. */
  authScheme?: string
  extraHeaders?: Record<string, string>
  /**
   * When true, owned loop should intensify weak-model harness behavior.
   * Explicit false disables auto heuristics for that profile.
   * Undefined = apply heuristics (localhost / small model tags).
   */
  weak?: boolean
}

export interface LlmProfilesState {
  /** Active profile name, or null when none configured. */
  active: string | null
  profiles: LlmProfile[]
}

/** Fields accepted by merge/upsert. Undefined = leave existing / unset. */
export type LlmProfilePatch = {
  name: string
  wire?: LlmWireKind
  providerLabel?: string
  baseUrl?: string
  model?: string
  authHeader?: string | null
  authScheme?: string | null
  extraHeaders?: Record<string, string> | null
  /** true | false | null (null clears explicit weak → heuristics) */
  weak?: boolean | null
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  name?: string
  tool_call_id?: string
  tool_calls?: ChatToolCall[]
}

export interface ChatToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ChatToolDef {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  tools?: ChatToolDef[]
  temperature?: number
  max_tokens?: number
}

export interface ChatCompletionResult {
  content: string | null
  tool_calls: ChatToolCall[]
  model: string
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  /** Finish reason when the wire exposes one (stop, tool_calls, length, …). */
  finish_reason?: string | null
  raw?: unknown
}

export interface LlmGenerateOptions {
  messages: ChatMessage[]
  tools?: ChatToolDef[]
  temperature?: number
  max_tokens?: number
  /** Per-call timeout ms (default from provider). */
  timeoutMs?: number
}

export interface LlmProvider {
  readonly profile: LlmProfile
  generate(opts: LlmGenerateOptions): Promise<ChatCompletionResult>
}

/** Defaults — conservative, override per call. */
export const LLM_DEFAULT_TIMEOUT_MS = 60_000
export const LLM_PROBE_TIMEOUT_MS = 45_000
export const LLM_PROBE_MAX_TOKENS = 64
export const LLM_PROBE_MAX_TOKENS_LOCAL = 256
