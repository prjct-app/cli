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

export interface GlobalEmbeddingsSettings {
  provider: 'openai-compatible'
  baseUrl: string
  model: string
}

const K_PROVIDER = 'embeddings.provider'
const K_BASE_URL = 'embeddings.baseUrl'
const K_MODEL = 'embeddings.model'

/** Current global embeddings settings, or null when BYOT isn't configured. */
export function resolveGlobalEmbeddings(): GlobalEmbeddingsSettings | null {
  const provider = getConfig(K_PROVIDER)
  const model = getConfig(K_MODEL)
  if (provider !== 'openai-compatible' || !model) return null
  return {
    provider: 'openai-compatible',
    baseUrl: String(getConfig(K_BASE_URL) ?? DEFAULT_EMBEDDINGS_BASE_URL),
    model: String(model),
  }
}

/** Persist the global embeddings provider/model/baseUrl (key handled apart). */
export function setGlobalEmbeddings(opts: {
  baseUrl?: string
  model?: string
}): GlobalEmbeddingsSettings {
  const settings: GlobalEmbeddingsSettings = {
    provider: 'openai-compatible',
    baseUrl: opts.baseUrl?.trim() || DEFAULT_EMBEDDINGS_BASE_URL,
    model: opts.model?.trim() || DEFAULT_EMBEDDINGS_MODEL,
  }
  setConfig(K_PROVIDER, settings.provider)
  setConfig(K_BASE_URL, settings.baseUrl)
  setConfig(K_MODEL, settings.model)
  return settings
}

/** Forget the global embeddings settings (semantic falls back to local). */
export function clearGlobalEmbeddings(): void {
  setConfig(K_PROVIDER, undefined)
  setConfig(K_BASE_URL, undefined)
  setConfig(K_MODEL, undefined)
}
