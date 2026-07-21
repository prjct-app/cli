/**
 * Resolve the active machine brain and generate chat/tool completions.
 *
 * Resolution order for "which profile":
 *   1. explicit opts.profile
 *   2. PRJCT_LLM_PROFILE env (via getActiveLlmProfile)
 *   3. persisted llm.active
 *
 * Key resolution is profile-safe (no cross-profile env bleed) — see secure-key.
 */

import { anthropicChat } from './anthropic'
import { isLocalBaseUrl } from './detect'
import { openaiCompatibleChat } from './openai-compat'
import { getActiveLlmProfile, getLlmProfile } from './profiles'
import { getLlmKey, isDummyKey, LOCAL_DUMMY_KEY } from './secure-key'
import type { ChatCompletionResult, LlmGenerateOptions, LlmProfile, LlmProvider } from './types'
import { LLM_DEFAULT_TIMEOUT_MS } from './types'

export type FetchImpl = typeof fetch

export interface ResolveLlmOptions {
  /** Profile name override; default = active (env + persisted) */
  profile?: string
  fetchImpl?: FetchImpl
  /** Inject key (tests); else secure store / env */
  apiKey?: string | null
  defaultTimeoutMs?: number
}

export class ProfileLlmProvider implements LlmProvider {
  constructor(
    readonly profile: LlmProfile,
    private readonly apiKey: string | null,
    private readonly fetchImpl: FetchImpl = fetch,
    private readonly defaultTimeoutMs: number = LLM_DEFAULT_TIMEOUT_MS
  ) {}

  async generate(opts: LlmGenerateOptions): Promise<ChatCompletionResult> {
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs

    if (this.profile.wire === 'anthropic') {
      if (!this.apiKey || isDummyKey(this.apiKey)) {
        throw new Error(
          `Anthropic profile '${this.profile.name}' has no API key. ` +
            `Set with: prjct llm set --name ${this.profile.name} --key <sk-ant-…>`
        )
      }
      return anthropicChat(
        this.profile,
        {
          messages: opts.messages,
          tools: opts.tools,
          temperature: opts.temperature,
          max_tokens: opts.max_tokens,
          timeoutMs,
        },
        this.apiKey,
        this.fetchImpl
      )
    }

    // OpenAI-compat: local runtimes accept dummy/empty key
    const key = this.apiKey ?? (isLocalBaseUrl(this.profile.baseUrl) ? LOCAL_DUMMY_KEY : null)

    if (!key && !isLocalBaseUrl(this.profile.baseUrl)) {
      throw new Error(
        `Profile '${this.profile.name}' has no API key. ` +
          `Set with: prjct llm set --name ${this.profile.name} --key <api-key>`
      )
    }

    return openaiCompatibleChat(
      this.profile,
      {
        messages: opts.messages,
        tools: opts.tools,
        temperature: opts.temperature,
        max_tokens: opts.max_tokens,
        timeoutMs,
      },
      {
        apiKey: key,
        authHeader: this.profile.authHeader,
        authScheme: this.profile.authScheme,
        extraHeaders: this.profile.extraHeaders,
      },
      this.fetchImpl
    )
  }
}

/**
 * Resolve a provider for the active (or named) profile.
 * Returns null when no profile is configured.
 */
export async function resolveLlmProvider(
  opts: ResolveLlmOptions = {}
): Promise<LlmProvider | null> {
  const profile = opts.profile ? getLlmProfile(opts.profile) : getActiveLlmProfile()
  if (!profile) return null

  const activeName = getActiveLlmProfile()?.name
  const isActive = profile.name === activeName

  const apiKey =
    opts.apiKey !== undefined ? opts.apiKey : await getLlmKey(profile.name, { isActive })

  return new ProfileLlmProvider(profile, apiKey, opts.fetchImpl, opts.defaultTimeoutMs)
}

export { profileImpliesWeakMode } from './profiles'

/** Probe result is usable if there is non-empty content and/or tool_calls. */
export function isUsableCompletion(result: ChatCompletionResult): boolean {
  const text = (result.content ?? '').trim()
  if (text.length > 0) return true
  if (result.tool_calls.length > 0) return true
  return false
}

export function explainUnusableCompletion(
  result: ChatCompletionResult,
  profile: LlmProfile
): string {
  const tokens = result.usage?.total_tokens ?? result.usage?.completion_tokens
  const local = isLocalBaseUrl(profile.baseUrl)
  const parts = [
    'Model returned empty content (and no tool calls).',
    tokens != null ? `Tokens used: ${tokens}.` : null,
    result.finish_reason ? `finish_reason=${result.finish_reason}.` : null,
    local
      ? 'Local/thinking models often burn the budget on hidden reasoning — try a non-thinking model, raise num_ctx, or set reasoning_effort=none on the server alias.'
      : 'Check the model id and that the key has access.',
  ]
  return parts.filter(Boolean).join(' ')
}
