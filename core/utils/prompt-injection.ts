/**
 * Prompt-injection scanner — defense layer for user-captured content
 * that later gets inlined into LLM context (topical-memory hook, MCP
 * memory tools, vault `.md` files read by subagents).
 *
 * Mirrors `secret-scanner`'s contract on purpose:
 *   - pure regex, no I/O
 *   - no imports from `storage/*`, `infrastructure/*`, `path-manager`
 *   - same `scan*(): string[]` shape so callers can compose both
 *
 * Conservative list — any hit blocks the capture unless the caller
 * passes `--force`. Better a false positive than a poisoned memory
 * entry hijacking a future session.
 */

const INJECTION_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  {
    name: 'instruction-override',
    re: /\b(ignore|disregard|override|forget)\b[^.]{0,40}\b(previous|prior|above|system|prompt|instructions?|rules?|constraints?)\b/i,
  },
  {
    name: 'role-play-injection',
    re: /\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be|roleplay\s+as|assume\s+the\s+role)\b[^.]{0,40}\b(system|admin|root|developer|operator|jailbreak)\b/i,
  },
  {
    name: 'jailbreak-phrase',
    re: /\b(DAN\s+mode|do\s+anything\s+now|without\s+restrictions?|bypass\s+(?:safety|filters?|guidelines?)|jailbreak\s+mode)\b/i,
  },
  {
    name: 'fake-system-tag',
    re: /<\s*(?:system|assistant|tool[_-]?call|function[_-]?call)\s*>/i,
  },
]

export const PROMPT_INJECTION_PATTERN_NAMES: ReadonlyArray<string> = INJECTION_PATTERNS.map(
  (p) => p.name
)

export function scanForPromptInjection(text: string): string[] {
  const hits: string[] = []
  for (const { name, re } of INJECTION_PATTERNS) if (re.test(text)) hits.push(name)
  return hits
}

/**
 * Escape markdown control characters in a tag VALUE so an attacker
 * can't smuggle wikilinks, code-fences, or bracketed pseudo-tool-calls
 * through `--tags k=<payload>`. Keys are already validated upstream
 * (`/^[a-z][a-z0-9_-]*$/`); only values need this.
 */
export function escapeMarkdownInline(s: string): string {
  return s.replace(/[`*_[\](){}<>\\]/g, (m) => `\\${m}`)
}
