/**
 * Junk capture detector — refuse accidental vault pollution at SoT.
 *
 * Patterns we see in dogfood: bare GTD misroutes (`todo_write`, `judgment status`),
 * opaque mem lookups (`mem get mem_5869`), single-word dumps, "wip"/"n/a".
 * Shared by captureGate (write path) and dream/triage (cleanup path).
 */

/** Exact/near-exact low-signal phrases (case-insensitive). */
const JUNK_PHRASE_RE =
  /^(current work|wip|todo|misc|n\/a|none|latest|unreleased|changelog|ok|yes|no|test|asdf|xxx|foo|bar|baz|null|undefined)$/i

/**
 * Tool/command dumps that are not knowledge — snake_case or space-separated
 * verb stacks agents accidentally capture as inbox.
 */
const JUNK_TOOLISH_RE =
  /^(todo_write|todo_read|judgment status|judgment next|mem get|memory get|spec_get|analysis-get|prjct (work|ship|sync|land|prime|status|help)|p\.\s*\w+)$/i

/** Bare mem_id dumps without prose. */
const BARE_MEM_ID_RE = /^(mem[_-]?\d+|mem get mem[_-]?\d+)$/i

export interface JunkVerdict {
  junk: boolean
  reason: string
}

/**
 * True when content should never enter the living vault as new knowledge.
 * Force-flag on remember still bypasses at the trust layer only — captureGate
 * callers should pass force separately.
 */
export function isJunkCaptureContent(content: string): JunkVerdict {
  const normalized = content.trim().replace(/\s+/g, ' ')
  if (normalized.length === 0) {
    return { junk: true, reason: 'empty content' }
  }
  // Ultra-short dumps (≤12) never carry a decision/learning.
  if (normalized.length <= 12) {
    return { junk: true, reason: 'too short (≤12 chars)' }
  }
  // Single token without punctuation/spaces — almost always a misroute.
  if (!/[\s.:;,—–\-/?!]/.test(normalized) && normalized.length < 40) {
    // Allow multi-word-looking tokens with hyphens that are real (anti-pattern names)
    if (!normalized.includes('-') || normalized.length < 20) {
      if (JUNK_PHRASE_RE.test(normalized) || /^[a-z][a-z0-9_]*$/i.test(normalized)) {
        return { junk: true, reason: 'single-token dump / tool name' }
      }
    }
  }
  if (JUNK_PHRASE_RE.test(normalized)) {
    return { junk: true, reason: 'noise phrase' }
  }
  if (JUNK_TOOLISH_RE.test(normalized)) {
    return { junk: true, reason: 'tool/command dump' }
  }
  if (BARE_MEM_ID_RE.test(normalized)) {
    return { junk: true, reason: 'bare mem id dump' }
  }
  // Very short multi-word command dumps: "insights cost 30", "workflow list"
  const words = normalized.split(' ')
  if (words.length <= 3 && normalized.length <= 32 && /^[a-z0-9_ -]+$/i.test(normalized)) {
    const first = words[0]?.toLowerCase() ?? ''
    if (
      [
        'todo',
        'judgment',
        'insights',
        'workflow',
        'spec',
        'analysis',
        'harness',
        'memory',
        'prjct',
      ].includes(first)
    ) {
      return { junk: true, reason: 'short command-like dump' }
    }
  }
  return { junk: false, reason: 'ok' }
}
