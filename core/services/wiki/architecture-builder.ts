/**
 * Baseline architecture synthesis.
 *
 * The vault's `architecture.md` used to exist ONLY when an LLM analysis had
 * been run — so most projects had none, and the "read architecture.md first"
 * contract 404'd. This builds a deterministic baseline from the knowledge the
 * project already recorded: its decisions (the *why* behind choices) and its
 * gotchas (the traps). That synthesis is the vault's unique value — it does not
 * exist anywhere else, unlike the per-entry pages which mirror the DB. When a
 * richer LLM analysis IS present, the caller prefers that and ignores this.
 */

import type { MemoryEntry } from '../../memory/entries'
import { deriveTitle } from '../../memory/format'
import { truncate } from './_shared'

const MAX_PER_SECTION = 20

function teaser(content: string): string {
  return truncate(content.replace(/\s+/g, ' ').trim(), 200)
}

function bullet(entry: MemoryEntry): string {
  return `- **${deriveTitle(entry)}** — ${teaser(entry.content)}  \`${entry.id}\``
}

/**
 * Synthesize `architecture.md` from declared memory. Returns null when there's
 * nothing load-bearing to say (no decisions and no gotchas), so the caller can
 * skip writing an empty page.
 */
export function buildArchitectureBaseline(declared: MemoryEntry[]): string | null {
  // `declared` is newest-first (allEntriesForIndex order); keep that — recent
  // decisions describe the current shape of the project.
  const decisions = declared.filter((e) => e.type === 'decision').slice(0, MAX_PER_SECTION)
  const gotchas = declared.filter((e) => e.type === 'gotcha').slice(0, MAX_PER_SECTION)
  if (decisions.length === 0 && gotchas.length === 0) return null

  const lines: string[] = ['# Architecture', '']
  lines.push(
    '> Synthesized from project memory — the decisions and gotchas the project recorded.',
    '> Read this before re-reading source. The full knowledge graph is under `memory/`.',
    ''
  )

  if (decisions.length > 0) {
    lines.push('## Key decisions — the *why*', '')
    for (const d of decisions) lines.push(bullet(d))
    lines.push('')
  }

  if (gotchas.length > 0) {
    lines.push('## Known gotchas — traps to avoid', '')
    for (const g of gotchas) lines.push(bullet(g))
    lines.push('')
  }

  lines.push('---', '', 'See also: [project wiki](index.md)', '')
  return `${lines.join('\n')}\n`
}
