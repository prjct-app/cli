/**
 * Shared helpers for Claude Code hook subcommands.
 *
 * Anti-harness contract: hooks describe state, never prescribe action.
 * Output is a short markdown block read as WHAT, not HOW. No "first do
 * X, then Y" language — just "here's who you are, here's what matters
 * right now". Claude decides the rest.
 *
 * All hooks share:
 *   - Never throw (`safeRun`) — exit 0 with `{}` on any internal error
 *     so the host session is never disturbed.
 *   - Short stdin timeout (200ms) — Claude Code pipes fast.
 *   - Keyword matcher — simple substring + regex over prompt text.
 */

import { deburr } from '../utils/deburr'

interface HookOutput {
  /** Top-level informational message. Accepted by every Claude Code hook
   *  event — the only safe channel for Stop, SubagentStart, and
   *  CwdChanged since their response schemas reject
   *  `hookSpecificOutput.additionalContext`. */
  systemMessage?: string
  /** Valid for SessionStart, UserPromptSubmit, PreToolUse, and
   *  PostToolUse. Injects context into the model's turn (stronger than a
   *  user-facing system message). Emitting this on any other event
   *  triggers a schema validation error in Claude Code. */
  hookSpecificOutput?: {
    hookEventName: string
    additionalContext?: string
  }
}

/** Events whose response schema accepts `hookSpecificOutput.additionalContext`. */
const ADDITIONAL_CONTEXT_EVENTS = new Set([
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
])

export async function readStdinSafe<T = Record<string, unknown>>(): Promise<T> {
  if (process.stdin.isTTY) return {} as T
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    process.stdin.on('data', (c: Buffer) => chunks.push(c))
    process.stdin.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8').trim()
        if (!raw) return resolve({} as T)
        resolve(JSON.parse(raw) as T)
      } catch {
        resolve({} as T)
      }
    })
    process.stdin.on('error', () => resolve({} as T))
    setTimeout(() => resolve({} as T), 200)
  })
}

/**
 * Emit the hook's JSON output and exit 0. Both success and no-op paths
 * should flow through this — it guarantees a valid JSON line on stdout
 * so the host parser is happy.
 */
export function emit(output: HookOutput | Record<string, never>): void {
  process.stdout.write(`${JSON.stringify(output)}\n`)
}

function emitEmpty(): void {
  emit({})
}

/**
 * Wrap a hook body so any thrown error becomes `{}` instead of a crash.
 * If the host kills the process mid-execution, the cost is just "no
 * context injected this turn" — the next hook will retry fresh.
 */
export async function safeRun(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch {
    emitEmpty()
  }
}

/**
 * Cheap keyword extraction — unique tokens ≥ 3 chars, max 8.
 *
 * Pre-splits camelCase / PascalCase so `setupOAuthCallback` yields
 * `setup`, `oauth`, `callback` AND the compound dashed form, both
 * useful as FTS5 match candidates. Stopwords trimmed to true noise
 * (articles, demonstratives, pronouns) — coding-intent verbs like
 * `need`/`want`/`should` stay, since "should we cache responses?"
 * loses signal otherwise.
 *
 * Unicode-aware: tokens are deburred ("búsqueda" → "busqueda", matching
 * FTS5 unicode61's remove_diacritics indexing) and split on any
 * non-letter/digit, so Spanish/mixed-language prompts produce real
 * keywords instead of mangled fragments (the old `[^a-z0-9]` split
 * turned "qué pasó" into nothing). Spanish function words join the
 * stopword list — the user prompts in Spanish even though stored
 * memories are English, and technical terms (daemon, cache, sync) pass
 * through either way.
 */
const STOPWORDS = new Set([
  // English noise
  'this',
  'that',
  'with',
  'from',
  'have',
  'your',
  'please',
  'would',
  'about',
  'there',
  'these',
  'those',
  'what',
  'when',
  'where',
  'which',
  'while',
  'will',
  'been',
  'were',
  'they',
  'them',
  'their',
  // Spanish noise (post-deburr forms; ≥3 chars — shorter never tokenizes)
  'que',
  'como',
  'cuando',
  'donde',
  'porque',
  'para',
  'pero',
  'por',
  'con',
  'sin',
  'los',
  'las',
  'del',
  'una',
  'uno',
  'unos',
  'unas',
  'este',
  'esta',
  'esto',
  'estos',
  'estas',
  'eso',
  'esos',
  'esas',
  'mas',
  'muy',
  'todo',
  'toda',
  'todos',
  'todas',
  'sobre',
  'entre',
  'hasta',
  'desde',
  'hace',
  'hacer',
  'tiene',
  'tienen',
  'debe',
  'deben',
  'puede',
  'pueden',
  'esta',
  'estan',
  'ser',
  'son',
  'algo',
  'ahora',
  'aqui',
  'bien',
  'cada',
  'dale',
])

export function extractKeywords(text: string, maxCount = 8): string[] {
  // setupOAuthCallback → setup OAuth Callback → setup oauth callback,
  // then tokenize on every non-word boundary (dash, space, punctuation).
  // Yields atomic tokens ['setup', 'oauth', 'callback'] so an FTS5 MATCH
  // can OR them and still find a memory entry that mentions any one.
  const normalized = deburr(
    text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  ).toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  for (const tok of normalized.split(/[^\p{L}\p{N}]+/u)) {
    if (tok.length < 3) continue
    if (STOPWORDS.has(tok)) continue
    if (seen.has(tok)) continue
    seen.add(tok)
    out.push(tok)
    if (out.length >= maxCount) break
  }
  return out
}

/**
 * Replace any unpaired UTF-16 surrogate with U+FFFD.
 *
 * JS strings are UTF-16; an astral character (emoji, non-BMP CJK) is a
 * high+low surrogate pair. A lone surrogate — a high not followed by a
 * low, or a low not preceded by a high — is a well-formed JS string but
 * NOT representable in UTF-8. When Claude Code forwards our injected
 * context into the model request body, the Anthropic API rejects it
 * with `400 ... no low surrogate in string`, killing the user's turn.
 *
 * Two ways a lone surrogate reaches us: (1) truncation cutting between a
 * pair — handled at the source by `safeTruncate` — and (2) corrupted
 * source content captured by a user. This scrub at the single emit
 * choke point (`buildHookOutput`) defends against both, for every hook.
 */
export function stripLoneSurrogates(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�')
}

/**
 * Truncate `s` to at most `max` UTF-16 units, appending `marker`, WITHOUT
 * ever splitting a surrogate pair. A naive `s.slice(0, n)` can land
 * between a high and low surrogate, leaving a trailing lone high
 * surrogate that makes the API request body invalid JSON (see
 * `stripLoneSurrogates`). If the last retained unit is a high surrogate
 * we drop it, so the cut always lands on a code-point boundary.
 */
export function safeTruncate(s: string, max: number, marker = '\n… [truncated]'): string {
  if (s.length <= max) return s
  let end = Math.max(0, max - marker.length)
  const last = s.charCodeAt(end - 1)
  if (last >= 0xd800 && last <= 0xdbff) end -= 1 // trailing high surrogate → drop it
  return s.slice(0, Math.max(0, end)) + marker
}

export function buildHookOutput(event: string, context: string | null): HookOutput {
  if (!context) return {}
  const safe = stripLoneSurrogates(context)
  if (ADDITIONAL_CONTEXT_EVENTS.has(event)) {
    return { hookSpecificOutput: { hookEventName: event, additionalContext: safe } }
  }
  return { systemMessage: safe }
}
