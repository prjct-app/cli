/**
 * Compact agent-surface protocol.
 *
 * This belongs in always-loaded instruction files (AGENTS.md, CLAUDE.md,
 * IDE rules). Keep it small: these files route agents into the RAG, they do
 * not carry project history or the full living-context contract.
 */

export const AGENT_RAG_PROTOCOL_LINES = [
  '- prjct is a RAG-backed project memory harness. Do not preload project history into agent instructions.',
  '- Start work with `prjct work "<intent>" --md`; use the surfaced related context and likely files before planning/editing.',
  '- Pull more context on demand with `prjct search`, `prjct context memory`, `prjct guard`, or MCP `prjct_*` tools.',
  '- The vault `_generated/` is a regenerated SQLite snapshot for Read/Glob fallback, not the source of truth and not something to load wholesale.',
  '- On close, save synthesized context via `prjct remember context "<...>"`: what changed, why it matters, key UI data, model/tokens if known, files, pattern/anti-pattern, outcome, next implication.',
  '- Raw quotes, detector rows, counters, and transcript chunks are inputs to synthesis, not durable context.',
] as const

export const AGENT_RAG_PROTOCOL = AGENT_RAG_PROTOCOL_LINES.join('\n')
