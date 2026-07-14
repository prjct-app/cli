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
 * Low-stakes types where ultra-short content is almost never knowledge.
 * Note: `context` is intentionally excluded — short hand-offs and test
 * fixtures are valid; junk for context still matches tool dumps / phrases.
 */
const LOW_STAKES = new Set(['inbox', 'todo', 'idea', 'question'])

/**
 * True when content should never enter the living vault as new knowledge.
 * @param type optional memory type — short-length rules are stricter for
 *             inbox/todo; judgment types only refuse clear tool dumps / phrases.
 */
export function isJunkCaptureContent(content: string, type?: string): JunkVerdict {
  const normalized = content.trim().replace(/\s+/g, ' ')
  if (normalized.length === 0) {
    return { junk: true, reason: 'empty content' }
  }

  // Universal: tool dumps, bare mem ids, known noise phrases (any type).
  if (JUNK_PHRASE_RE.test(normalized)) {
    return { junk: true, reason: 'noise phrase' }
  }
  if (JUNK_TOOLISH_RE.test(normalized)) {
    return { junk: true, reason: 'tool/command dump' }
  }
  if (BARE_MEM_ID_RE.test(normalized)) {
    return { junk: true, reason: 'bare mem id dump' }
  }

  const low = !type || LOW_STAKES.has(type)

  // Ultra-short: only gate low-stakes (judgment may be "use Bun" / "runtime: bun").
  if (low && normalized.length <= 12) {
    return { junk: true, reason: 'too short (≤12 chars)' }
  }
  // Single-token tool dumps: snake_case names (todo_write) always refuse.
  // Bare letters like "A"/"B" used in unit fixtures / short tags are OK on
  // judgment types; low-stakes still refuse short single tokens.
  if (!/[\s.:;,—–\-/?!]/.test(normalized) && normalized.length < 40) {
    if (normalized.includes('_') && /^[a-z][a-z0-9_]*$/i.test(normalized)) {
      return { junk: true, reason: 'single-token dump / tool name' }
    }
    if (low && /^[a-z][a-z0-9_]*$/i.test(normalized) && normalized.length <= 24) {
      return { junk: true, reason: 'single-token dump / tool name' }
    }
  }

  // Short command-like: "insights cost 30", "workflow list" — low-stakes only.
  if (low) {
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
  }
  return { junk: false, reason: 'ok' }
}
