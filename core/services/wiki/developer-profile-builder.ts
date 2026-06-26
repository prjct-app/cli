/**
 * Developer profile synthesis — the "know the developer" half of the RAG north
 * star (the project half is architecture.md).
 *
 * prjct already captures who the developer is, scattered across two memory
 * streams: explicit `feedback` (the rules they stated — "memory in English",
 * "no native deps", "ship as minor") and `improvement-signal` friction (the
 * moments they pushed back). This builder synthesizes them into one
 * `developer.md` so an agent can act as the developer would WITHOUT being told
 * each time — the dev and the LLM moving as one.
 *
 * Deterministic; no LLM. Returns null when there's nothing to say yet.
 */

import type { MemoryEntry } from '../../memory/entries'
import { deriveTitle } from '../../memory/format'
import { truncate } from './_shared'
import { summarizeFrictionLesson } from './friction-lessons'

const MAX_PREFERENCES = 25
const MAX_FRICTION = 15

function teaser(content: string): string {
  return truncate(content.replace(/\s+/g, ' ').trim(), 200)
}

/** Structured lessons lead; legacy rows fall back to their first line. */
function frictionLine(content: string): string {
  return summarizeFrictionLesson(content, 240)
}

export function buildDeveloperProfile(declared: MemoryEntry[]): string | null {
  // `declared` is newest-first; recent guidance reflects current preference.
  const preferences = declared.filter((e) => e.type === 'feedback').slice(0, MAX_PREFERENCES)
  const friction = declared
    .filter((e) => e.type === 'improvement-signal' && e.tags?.source === 'friction-detector')
    .slice(0, MAX_FRICTION)

  if (preferences.length === 0 && friction.length === 0) return null

  const lines: string[] = ['# Developer profile', '']
  lines.push(
    '> Synthesized from the developer’s stated feedback and their pushback.',
    '> Read this to act as they would — match these preferences without being asked.',
    ''
  )

  if (preferences.length > 0) {
    lines.push('## Preferences & guidance — the rules to follow', '')
    for (const p of preferences)
      lines.push(`- **${deriveTitle(p)}** — ${teaser(p.content)}  \`${p.id}\``)
    lines.push('')
  }

  if (friction.length > 0) {
    lines.push('## Friction history — what frustrated them, do not repeat', '')
    for (const f of friction) lines.push(`- ${frictionLine(f.content)}  \`${f.id}\``)
    lines.push('')
  }

  lines.push('---', '', 'See also: [architecture](architecture.md) · [project wiki](index.md)', '')
  return `${lines.join('\n')}\n`
}
