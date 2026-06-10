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
