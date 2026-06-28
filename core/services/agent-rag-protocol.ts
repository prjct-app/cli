/**
 * Compact agent-surface protocol.
 *
 * This belongs in always-loaded instruction files (AGENTS.md, CLAUDE.md,
 * IDE rules). Keep it small: these files route agents into the RAG, they do
 * not carry project history or the full living-context contract.
 */

export const AGENT_RAG_PROTOCOL_LINES = [
  '- prjct is a RAG-backed project memory harness. Do not preload project history into agent instructions.',
  '- Start work with `prjct work "<intent>" --md`; read the surfaced likely files FIRST — do not grep-walk the repo to rediscover where code lives.',
  '- Pull more context on demand with `prjct search`, `prjct context memory`, `prjct guard`, or MCP `prjct_*` tools.',
  '- The vault `_generated/` is a Read/Glob fallback snapshot, not the source of truth and not something to load wholesale.',
  '- On close, save synthesized context with `prjct remember context "<...>"`: what changed, why, key data, files, outcome, next — not raw quotes, counters, or transcript chunks.',
] as const

export const AGENT_RAG_PROTOCOL = AGENT_RAG_PROTOCOL_LINES.join('\n')
