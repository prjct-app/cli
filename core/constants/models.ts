/** Context window sizes by model identifier (in tokens) */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Claude models (short names from model.ts)
  opus: 200_000,
  sonnet: 200_000,
  haiku: 200_000,
  // Gemini models
  '2.5-pro': 1_000_000,
  '2.5-flash': 1_000_000,
  '2.0-flash': 1_000_000,
  // Full model IDs (for direct API usage)
  'claude-opus-4.5': 200_000,
  'claude-sonnet-4.5': 200_000,
  'claude-haiku-4.5': 200_000,
  'claude-opus-4-6': 200_000,
  // Default fallback
  default: 200_000,
}

/** Ratio of context window reserved for input (rest for output) */
export const INPUT_RATIO = 0.65
