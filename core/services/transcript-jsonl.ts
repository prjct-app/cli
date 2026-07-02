/**
 * Shared JSONL tokenization for Claude Code session transcripts.
 *
 * Three Stop-hook services (transcript-learner, friction-detector,
 * skill-miss-detector) consume the same transcript file. Each used to
 * read and JSON.parse it independently — 3 reads + 3 parse passes of a
 * potentially multi-hundred-KB file per session end. The Stop hook now
 * reads + parses ONCE via this module and hands the raw line objects to
 * each service; every service keeps its own typed projection (role
 * inference, text extraction) over the shared lines.
 */

export type TranscriptJsonlLine = Record<string, unknown>

/** Parse transcript JSONL into raw line objects, skipping malformed lines. */
export function parseTranscriptJsonl(raw: string): TranscriptJsonlLine[] {
  const out: TranscriptJsonlLine[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (parsed && typeof parsed === 'object') out.push(parsed as TranscriptJsonlLine)
    } catch {
      /* skip malformed line */
    }
  }
  return out
}

export interface TranscriptUsage {
  tokensIn: number
  tokensOut: number
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Pull an {in,out} usage pair from a single usage object, tolerant of every
 * major provider's field naming so prjct's token accounting is agent-agnostic
 * (Claude, OpenAI/Codex, Gemini), not Claude-only:
 *   - Claude   : input_tokens / output_tokens (+ cache_creation/read as input)
 *   - OpenAI   : prompt_tokens / completion_tokens (Chat); input_tokens/output_tokens (Responses)
 *   - Gemini   : promptTokenCount / candidatesTokenCount
 * Cache reads/creations count as input — real billed input the cycle incurred.
 */
function usagePairFrom(usage: Record<string, unknown>): TranscriptUsage & { cacheRead: number } {
  // Per-turn input deltas (safe to sum): genuinely new input each turn.
  const tokensIn =
    num(usage.input_tokens) +
    num(usage.cache_creation_input_tokens) +
    num(usage.prompt_tokens) +
    num(usage.promptTokenCount)
  const tokensOut =
    num(usage.output_tokens) + num(usage.completion_tokens) + num(usage.candidatesTokenCount)
  // cache_read is the cumulative cached prefix RE-REPORTED every turn; summing
  // it across turns inflates tokensIn quadratically (reviewed audit, spec
  // 4b5bc99e). Return it separately so the caller takes the last/max, not a sum.
  const cacheRead = num(usage.cache_read_input_tokens)
  return { tokensIn, tokensOut, cacheRead }
}

/**
 * Sum input/output token usage across the assistant turns in a transcript.
 *
 * Looks for a usage object in the shapes the supported agents emit
 * (`message.usage`, top-level `usage`, or Gemini's `usageMetadata`) and sums
 * via {@link usagePairFrom}. This feeds `tasks.tokens_in/out`, which closes the
 * work-cost coverage gap (the whole point: prove prjct's net token savings).
 * Non-Claude agents that don't write a readable transcript report tokens
 * instead via the `prjct_task_set_status` MCP tool / `prjct status` CLI.
 */
export function sumTranscriptUsage(lines: TranscriptJsonlLine[]): TranscriptUsage {
  let tokensIn = 0
  let tokensOut = 0
  // cache_read is cumulative (re-reported each turn) — take the largest single
  // report, not the sum, so a long session doesn't inflate input quadratically.
  let maxCacheRead = 0
  for (const line of lines) {
    const usage =
      asRecord(asRecord(line.message)?.usage) ??
      asRecord(line.usage) ??
      asRecord(line.usageMetadata)
    if (!usage) continue
    const pair = usagePairFrom(usage)
    tokensIn += pair.tokensIn
    tokensOut += pair.tokensOut
    if (pair.cacheRead > maxCacheRead) maxCacheRead = pair.cacheRead
  }
  return { tokensIn: tokensIn + maxCacheRead, tokensOut }
}

/**
 * Per-model usage sums — same semantics as sumTranscriptUsage (cache_read is
 * cumulative → take each model's max single report, not the sum). Model id
 * comes from the assistant line's `message.model`; usage lines with no model
 * attribution are grouped under 'unknown'. Powers the per-model cost
 * breakdown that PROVES whether orchestration's model routing saves money.
 */
export function sumTranscriptUsageByModel(
  lines: TranscriptJsonlLine[]
): Map<string, TranscriptUsage> {
  const acc = new Map<string, { tokensIn: number; tokensOut: number; maxCacheRead: number }>()
  for (const line of lines) {
    const message = asRecord(line.message)
    const usage = asRecord(message?.usage) ?? asRecord(line.usage) ?? asRecord(line.usageMetadata)
    if (!usage) continue
    const model = typeof message?.model === 'string' && message.model ? message.model : 'unknown'
    const pair = usagePairFrom(usage)
    const cur = acc.get(model) ?? { tokensIn: 0, tokensOut: 0, maxCacheRead: 0 }
    cur.tokensIn += pair.tokensIn
    cur.tokensOut += pair.tokensOut
    if (pair.cacheRead > cur.maxCacheRead) cur.maxCacheRead = pair.cacheRead
    acc.set(model, cur)
  }
  const out = new Map<string, TranscriptUsage>()
  for (const [model, v] of acc) {
    out.set(model, { tokensIn: v.tokensIn + v.maxCacheRead, tokensOut: v.tokensOut })
  }
  return out
}
