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
function usagePairFrom(usage: Record<string, unknown>): TranscriptUsage {
  const tokensIn =
    num(usage.input_tokens) +
    num(usage.cache_creation_input_tokens) +
    num(usage.cache_read_input_tokens) +
    num(usage.prompt_tokens) +
    num(usage.promptTokenCount)
  const tokensOut =
    num(usage.output_tokens) + num(usage.completion_tokens) + num(usage.candidatesTokenCount)
  return { tokensIn, tokensOut }
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
  for (const line of lines) {
    const usage =
      asRecord(asRecord(line.message)?.usage) ??
      asRecord(line.usage) ??
      asRecord(line.usageMetadata)
    if (!usage) continue
    const pair = usagePairFrom(usage)
    tokensIn += pair.tokensIn
    tokensOut += pair.tokensOut
  }
  return { tokensIn, tokensOut }
}
