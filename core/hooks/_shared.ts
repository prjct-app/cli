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

interface HookOutput {
  /** Top-level informational message. Accepted by every Claude Code hook
   *  event — the only safe channel for Stop, SubagentStart, CwdChanged,
   *  and PreToolUse since their response schemas reject
   *  `hookSpecificOutput.additionalContext`. */
  systemMessage?: string
  /** Only valid for SessionStart, UserPromptSubmit, and PostToolUse.
   *  Injects context into the model's turn (stronger than a user-facing
   *  system message). Emitting this on any other event triggers a
   *  schema validation error in Claude Code. */
  hookSpecificOutput?: {
    hookEventName: string
    additionalContext?: string
  }
}

/** Events whose response schema accepts `hookSpecificOutput.additionalContext`. */
const ADDITIONAL_CONTEXT_EVENTS = new Set(['SessionStart', 'UserPromptSubmit', 'PostToolUse'])

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
 * Cheap keyword extraction — lowercase words ≥ 4 chars, unique, max 8.
 * Used by prompt / session hooks to score memory relevance without
 * pulling in a stemmer or embedding pipeline.
 */
export function extractKeywords(text: string, maxCount = 8): string[] {
  const stopwords = new Set([
    'this',
    'that',
    'with',
    'from',
    'have',
    'your',
    'please',
    'need',
    'want',
    'would',
    'should',
    'could',
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
  ])
  const seen = new Set<string>()
  const out: string[] = []
  for (const word of text.toLowerCase().match(/[a-z0-9-]{4,}/g) ?? []) {
    if (stopwords.has(word)) continue
    if (seen.has(word)) continue
    seen.add(word)
    out.push(word)
    if (out.length >= maxCount) break
  }
  return out
}

export function buildHookOutput(event: string, context: string | null): HookOutput {
  if (!context) return {}
  if (ADDITIONAL_CONTEXT_EVENTS.has(event)) {
    return { hookSpecificOutput: { hookEventName: event, additionalContext: context } }
  }
  return { systemMessage: context }
}
