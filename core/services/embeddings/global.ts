/**
 * GLOBAL embeddings config — one setting for every project, stored in the
 * shared `~/.prjct-cli/config/global.json` (flat keys; the secret API key
 * lives in the Keychain via secure-key, never here).
 *
 * This is the BYOT path: the user brings an API key once, globally, and every
 * project's semantic recall upgrades from the local subword embedder to a real
 * model. Per-project `config.embeddings` still wins when present.
 */

import { getConfig, setConfig } from '../global-config'

/** Sensible high-quality default — small, cheap, strong, OpenAI-compatible. */
export const DEFAULT_EMBEDDINGS_BASE_URL = 'https://api.openai.com/v1'
export const DEFAULT_EMBEDDINGS_MODEL = 'text-embedding-3-small'

/**
 * Infer the provider's base URL from an API-key prefix, so users can paste just
 * `--key` and skip `--base-url`. API keys are provider-stamped at the prefix:
 * `sk-or-…` is OpenRouter, `sk-ant-…` is Anthropic, etc. Returns undefined when
 * the prefix isn't recognized (the caller keeps the existing/default base URL).
 * Order matters — the OpenRouter/Anthropic prefixes are checked before the
 * generic `sk-` (OpenAI) so they don't get misrouted.
 */
export function detectBaseUrlFromKey(
  key: string
): { baseUrl: string; provider: string } | undefined {
  const k = key.trim()
  if (/^sk-or-/i.test(k)) return { baseUrl: 'https://openrouter.ai/api/v1', provider: 'OpenRouter' }
  if (/^sk-ant-/i.test(k)) return undefined // Anthropic has no /embeddings endpoint
  if (/^(gsk_|gpg_)/i.test(k)) return undefined // Groq / others without embeddings
  if (/^sk-/i.test(k)) return { baseUrl: 'https://api.openai.com/v1', provider: 'OpenAI' }
  if (/^pa-/i.test(k)) return { baseUrl: 'https://api.voyageai.com/v1', provider: 'Voyage' }
  return undefined
}

export interface GlobalEmbeddingsSettings {
  provider: 'openai-compatible'
  baseUrl: string
  model: string
  /** Header carrying the key. Default `authorization`. `api-key` for Azure. */
  authHeader?: string
  /** Scheme/prefix before the key. Default `Bearer`. `''` = raw key. */
  authScheme?: string
  /** Extra static headers sent on every request. */
  extraHeaders?: Record<string, string>
  /** Raw query string appended to the URL, e.g. `api-version=2023-05-15`. */
  query?: string
}

const K_PROVIDER = 'embeddings.provider'
const K_BASE_URL = 'embeddings.baseUrl'
const K_MODEL = 'embeddings.model'
const K_AUTH_HEADER = 'embeddings.authHeader'
const K_AUTH_SCHEME = 'embeddings.authScheme'
const K_HEADERS = 'embeddings.headers' // JSON string of Record<string,string>
const K_QUERY = 'embeddings.query'

/** Parse the stored extra-headers JSON; never throw on malformed input. */
function parseHeaders(raw: unknown): Record<string, string> | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(obj)) out[k] = String(v)
      return Object.keys(out).length ? out : undefined
    }
  } catch {
    /* malformed — ignore, fall back to no extra headers */
  }
  return undefined
}

/** Current global embeddings settings, or null when BYOT isn't configured. */
export function resolveGlobalEmbeddings(): GlobalEmbeddingsSettings | null {
  const provider = getConfig(K_PROVIDER)
  const model = getConfig(K_MODEL)
  if (provider !== 'openai-compatible' || !model) return null
  // `?? 'Bearer'` (not `||`) so an explicit empty scheme (raw key) is preserved.
  const authScheme = getConfig(K_AUTH_SCHEME)
  const authHeader = getConfig(K_AUTH_HEADER)
  const query = getConfig(K_QUERY)
  return {
    provider: 'openai-compatible',
    baseUrl: String(getConfig(K_BASE_URL) ?? DEFAULT_EMBEDDINGS_BASE_URL),
    model: String(model),
    authHeader: authHeader != null ? String(authHeader) : undefined,
    authScheme: authScheme != null ? String(authScheme) : undefined,
    extraHeaders: parseHeaders(getConfig(K_HEADERS)),
    query: query != null ? String(query) : undefined,
  }
}

/** Persist the global embeddings provider/model/baseUrl + auth (key handled
 *  apart). Partial-update friendly: a field not provided is LEFT AS-IS (so
 *  `set --key …` keeps your model/base URL); defaults apply only on first
 *  config. Pass an empty string to clear an optional auth field. */
export function setGlobalEmbeddings(opts: {
  baseUrl?: string
  model?: string
  authHeader?: string
  authScheme?: string
  extraHeaders?: Record<string, string>
  query?: string
}): GlobalEmbeddingsSettings {
  const existing = resolveGlobalEmbeddings()
  setConfig(K_PROVIDER, 'openai-compatible')
  // Only overwrite baseUrl/model when explicitly given; otherwise preserve the
  // current value (or seed the default on first config). This stops a partial
  // `set` from silently resetting an already-configured provider.
  if (opts.baseUrl?.trim()) setConfig(K_BASE_URL, opts.baseUrl.trim())
  else if (!existing) setConfig(K_BASE_URL, DEFAULT_EMBEDDINGS_BASE_URL)
  if (opts.model?.trim()) setConfig(K_MODEL, opts.model.trim())
  else if (!existing) setConfig(K_MODEL, DEFAULT_EMBEDDINGS_MODEL)

  // Optional auth knobs: only written when explicitly provided. Empty string
  // clears (deletes) the key; for authScheme, '' is meaningful (raw key) so we
  // store it literally rather than deleting.
  if (opts.authHeader !== undefined) setConfig(K_AUTH_HEADER, opts.authHeader.trim() || undefined)
  if (opts.authScheme !== undefined) setConfig(K_AUTH_SCHEME, opts.authScheme)
  if (opts.query !== undefined) setConfig(K_QUERY, opts.query.trim() || undefined)
  if (opts.extraHeaders !== undefined) {
    const has = Object.keys(opts.extraHeaders).length > 0
    setConfig(K_HEADERS, has ? JSON.stringify(opts.extraHeaders) : undefined)
  }

  const settings = resolveGlobalEmbeddings()
  // resolveGlobalEmbeddings can't be null here — we just set provider+model.
  return settings as GlobalEmbeddingsSettings
}

/** Forget the global embeddings settings (semantic falls back to local). */
export function clearGlobalEmbeddings(): void {
  setConfig(K_PROVIDER, undefined)
  setConfig(K_BASE_URL, undefined)
  setConfig(K_MODEL, undefined)
  setConfig(K_AUTH_HEADER, undefined)
  setConfig(K_AUTH_SCHEME, undefined)
  setConfig(K_HEADERS, undefined)
  setConfig(K_QUERY, undefined)
}
