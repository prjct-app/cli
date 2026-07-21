/**
 * Owned-loop multi-brain LLM layer.
 *
 * Configure: `prjct llm set|use|status|test|clear`
 * Runtime:   resolveLlmProvider() → generate()
 *
 * Does NOT replace Guest mode (Claude/Grok/Codex/OpenCode + MCP/hooks).
 * Embeddings stay on `prjct embeddings` — separate secret + config.
 */

export { anthropicChat, parseAnthropicResponse, toAnthropicMessages } from './anthropic'
export {
  detectBrainFromBaseUrl,
  detectBrainFromKey,
  isLocalBaseUrl,
  normalizeChatModelForBaseUrl,
  slugifyProfileName,
} from './detect'
export { fetchJson, LlmHttpError, normalizeMessageContent } from './http'
export { openaiCompatibleChat, parseOpenAiChatResponse } from './openai-compat'
export {
  canCompleteProfile,
  clearAllLlmProfiles,
  getActiveLlmProfile,
  getLlmProfile,
  LLM_PROFILE_ENV,
  listLlmProfiles,
  profileImpliesWeakMode,
  removeLlmProfile,
  setActiveLlmProfile,
  upsertLlmProfile,
} from './profiles'
export {
  explainUnusableCompletion,
  isUsableCompletion,
  ProfileLlmProvider,
  resolveLlmProvider,
} from './provider'
export {
  clearAllLlmKeys,
  clearLlmKey,
  getLlmKey,
  getLlmKeyLocation,
  isDummyKey,
  LLM_API_KEY_ENV,
  LOCAL_DUMMY_KEY,
  profileKeyEnvName,
  resetLlmKeyCache,
  setLlmKey,
} from './secure-key'
export type {
  ChatCompletionResult,
  ChatMessage,
  ChatToolCall,
  ChatToolDef,
  LlmGenerateOptions,
  LlmProfile,
  LlmProfilePatch,
  LlmProfilesState,
  LlmProvider,
  LlmWireKind,
} from './types'
export {
  LLM_DEFAULT_TIMEOUT_MS,
  LLM_PROBE_MAX_TOKENS,
  LLM_PROBE_MAX_TOKENS_LOCAL,
  LLM_PROBE_TIMEOUT_MS,
} from './types'
