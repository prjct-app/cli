/**
 * OpenAI-compatible chat completions (+ tools).
 * Covers OpenAI, OpenRouter, Ollama, LM Studio, xAI, and most gateways.
 *
 * Local (Ollama) extras:
 * - reasoning_effort: none + think: false to avoid thinking models burning max_tokens
 *   (see project gotcha: OpenAI-compat ignores bare think:false alone on some builds)
 */

import { isLocalBaseUrl } from './detect'
import { fetchJson, normalizeMessageContent } from './http'
import type { ChatCompletionRequest, ChatCompletionResult, ChatToolCall, LlmProfile } from './types'
import { LLM_DEFAULT_TIMEOUT_MS } from './types'

export interface OpenAiCompatAuth {
  apiKey: string | null
  authHeader?: string
  authScheme?: string
  extraHeaders?: Record<string, string>
}

function buildHeaders(auth: OpenAiCompatAuth): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(auth.extraHeaders ?? {}),
  }
  if (auth.apiKey) {
    // Preserve common casing; HTTP is case-insensitive but some proxies are picky.
    const header = auth.authHeader?.trim() || 'Authorization'
    const scheme = auth.authScheme === undefined ? 'Bearer' : auth.authScheme
    headers[header] = scheme ? `${scheme} ${auth.apiKey}`.trim() : auth.apiKey
  }
  return headers
}

function chatUrl(baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/, '')
  if (root.endsWith('/chat/completions')) return root
  return `${root}/chat/completions`
}

export async function openaiCompatibleChat(
  profile: LlmProfile,
  req: Omit<ChatCompletionRequest, 'model'> & { model?: string; timeoutMs?: number },
  auth: OpenAiCompatAuth,
  fetchImpl: typeof fetch = fetch
): Promise<ChatCompletionResult> {
  const model = req.model ?? profile.model
  const body: Record<string, unknown> = {
    model,
    messages: req.messages,
  }
  if (req.tools?.length) body.tools = req.tools
  if (req.temperature !== undefined) body.temperature = req.temperature
  if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens

  // Local runtimes: discourage "thinking" channels that swallow the budget.
  if (isLocalBaseUrl(profile.baseUrl)) {
    body.think = false
    body.reasoning_effort = 'none'
  }

  const { json } = await fetchJson(
    chatUrl(profile.baseUrl),
    {
      method: 'POST',
      headers: buildHeaders(auth),
      body: JSON.stringify(body),
      timeoutMs: req.timeoutMs ?? LLM_DEFAULT_TIMEOUT_MS,
    },
    fetchImpl
  )
  return parseOpenAiChatResponse(json, model)
}

export function parseOpenAiChatResponse(
  json: unknown,
  fallbackModel: string
): ChatCompletionResult {
  const obj = json as {
    model?: string
    choices?: Array<{
      finish_reason?: string | null
      message?: {
        content?: unknown
        tool_calls?: Array<{
          id?: string
          type?: string
          function?: { name?: string; arguments?: string }
        }>
      }
    }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  }
  const choice = obj.choices?.[0]
  const msg = choice?.message
  const tool_calls: ChatToolCall[] = (msg?.tool_calls ?? [])
    .filter((t) => t.function?.name)
    .map((t, i) => ({
      id: t.id ?? `call_${i}`,
      type: 'function' as const,
      function: {
        name: t.function?.name ?? '',
        arguments: t.function?.arguments ?? '{}',
      },
    }))
  return {
    content: normalizeMessageContent(msg?.content),
    tool_calls,
    model: obj.model ?? fallbackModel,
    usage: obj.usage,
    finish_reason: choice?.finish_reason ?? null,
    raw: json,
  }
}
