/**
 * Wiki Generator — emit an agent-crawlable markdown map of the project's
 * memory + shipped history to `.prjct/wiki/_generated/`.
 *
 * Why: prjct already holds the answers (memories, patterns, ships). The
 * fastest way for a subagent to read them is through its native Read/Glob
 * tools, not a CLI round-trip into SQLite. A static markdown tree eats
 * zero tokens until the agent opens the specific file it cares about.
 *
 * Regenerated on `prjct ship` and `prjct remember`. Regeneration is
 * incremental (hash-per-file manifest) so the common case — one new
 * memory entry touching 1-2 files — rewrites those 1-2 files instead of
 * the whole tree.
 *
 * Output layout (under the repo root):
 *   .prjct/wiki/
 *     README.md                       — user-editable pointer
 *     _generated/
 *       .manifest.json                — {relPath: sha256} for incremental rebuild
 *       index.md                      — entry point, links to everything
 *       ships/<slug>.md               — one file per shipped feature
 *       memory/<type>.md              — index for a type; links to chunks
 *       memory/<type>/chunk-N.md      — paged entries, CHUNK_SIZE per file
 *       tags/<key>.md                 — index for a tag; links to per-value pages
 *       tags/<key>/<value>.md         — entries sharing that exact tag pair
 *       patterns.md                   — inferred patterns + anti-patterns
 *
 * Large-corpus rule: if a bucket (by type or by tag key) has more than
 * CHUNK_SIZE entries, split into `memory/<type>/chunk-*.md`. Keeps any
 * single file under ~5K tokens so an agent opening one doesn't blow its
 * context budget on the first read.
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { formatMemoryMd, type MemoryEntry, projectMemory } from '../memory/project-memory'
import { analysisStorage } from '../storage/analysis-storage'
import llmAnalysisStorage from '../storage/llm-analysis-storage'
import shippedStorage from '../storage/shipped-storage'
import type { LLMAnalysis } from '../types/llm-analysis'
import type { ShippedFeature } from '../types/storage'
import { ensureObsidianVault } from './obsidian-vault'
import { ensureCapturedReadme } from './wiki-ingest'
import { migrateWikiLocationIfNeeded } from './wiki-migration'

// Generated output goes into a dedicated subdir so user notes placed in
// the vault root survive wiki rebuilds. Only this subdir gets touched.
const GENERATED_SUBDIR = '_generated'
const MANIFEST_FILE = '.manifest.json'

/**
 * Max entries per file. When a bucket exceeds this, it's paginated into
 * `<bucket>/chunk-1.md`, `<bucket>/chunk-2.md`, etc. with the root file
 * becoming an index. 50 is ~3-5K tokens per chunk — small enough that
 * an agent reading one stays under a reasonable budget.
 */
const CHUNK_SIZE = 50

type Manifest = Record<string, string>

// =============================================================================
// Pure builders — compute file bodies in memory before touching disk
// =============================================================================

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'unnamed'
  )
}

function sha256(body: string): string {
  return crypto.createHash('sha256').update(body).digest('hex').slice(0, 16)
}

function formatShipBody(ship: ShippedFeature): string {
  const lines: string[] = []
  lines.push(`# ${ship.name}`)
  lines.push('')
  lines.push(`- Shipped: ${ship.shippedAt}`)
  lines.push(`- Version: ${ship.version}`)
  if (ship.type) lines.push(`- Type: ${ship.type}`)
  if (ship.duration) lines.push(`- Duration: ${ship.duration}`)
  lines.push('')
  if (ship.description) {
    lines.push('## Description')
    lines.push('')
    lines.push(ship.description)
  }
  return `${lines.join('\n')}\n`
}

function groupByTagPair(entries: MemoryEntry[]): Map<string, Map<string, MemoryEntry[]>> {
  const byKey = new Map<string, Map<string, MemoryEntry[]>>()
  for (const entry of entries) {
    for (const [k, v] of Object.entries(entry.tags)) {
      let byValue = byKey.get(k)
      if (!byValue) {
        byValue = new Map()
        byKey.set(k, byValue)
      }
      const bucket = byValue.get(v) ?? []
      bucket.push(entry)
      byValue.set(v, bucket)
    }
  }
  return byKey
}

function chunkEntries<T>(entries: T[], size = CHUNK_SIZE): T[][] {
  if (entries.length <= size) return [entries]
  const out: T[][] = []
  for (let i = 0; i < entries.length; i += size) out.push(entries.slice(i, i + size))
  return out
}

function buildMemoryFiles(entries: MemoryEntry[]): Map<string, string> {
  // Emit `memory/<type>.md` as an index + `memory/<type>/chunk-N.md` when
  // a type bucket exceeds CHUNK_SIZE. Small buckets inline their entries
  // in the index file directly to save a hop.
  const files = new Map<string, string>()

  const byType = new Map<string, MemoryEntry[]>()
  for (const e of entries) {
    const bucket = byType.get(e.type) ?? []
    bucket.push(e)
    byType.set(e.type, bucket)
  }

  for (const [type, items] of byType) {
    const chunks = chunkEntries(items)
    if (chunks.length === 1) {
      // Small bucket: single file with everything inline.
      const body = [`# ${type.toUpperCase()}`, '', formatMemoryMd(items), ''].join('\n')
      files.set(`memory/${type}.md`, body)
      continue
    }

    // Large bucket: index + chunks.
    const indexLines = [
      `# ${type.toUpperCase()}`,
      '',
      `_${items.length} entries across ${chunks.length} chunks._`,
      '',
    ]
    for (let i = 0; i < chunks.length; i++) {
      const chunkRel = `${type}/chunk-${i + 1}.md`
      const body = [
        `# ${type.toUpperCase()} — chunk ${i + 1}/${chunks.length}`,
        '',
        formatMemoryMd(chunks[i]),
        '',
      ].join('\n')
      files.set(`memory/${chunkRel}`, body)
      indexLines.push(`- [chunk ${i + 1}](${chunkRel}) — ${chunks[i].length} entries`)
    }
    files.set(`memory/${type}.md`, `${indexLines.join('\n')}\n`)
  }

  return files
}

function buildTagFiles(entries: MemoryEntry[]): Map<string, string> {
  // One page per distinct tag pair (`tags/<key>/<value>.md`) + an index
  // per tag key (`tags/<key>.md`). Glob-discoverable by the agent.
  const files = new Map<string, string>()
  const byPair = groupByTagPair(entries)

  for (const [key, byValue] of byPair) {
    const keySlug = slugify(key)
    const indexLines = [`# Tag: ${key}`, '']
    const sortedValues = [...byValue.entries()].sort((a, b) => a[0].localeCompare(b[0]))

    for (const [value, items] of sortedValues) {
      const valueSlug = slugify(value)
      const chunks = chunkEntries(items)
      if (chunks.length === 1) {
        const body = [`# ${key}: ${value}`, '', formatMemoryMd(items), ''].join('\n')
        files.set(`tags/${keySlug}/${valueSlug}.md`, body)
        indexLines.push(`- [${value}](${keySlug}/${valueSlug}.md) — ${items.length} entries`)
      } else {
        for (let i = 0; i < chunks.length; i++) {
          const body = [
            `# ${key}: ${value} — chunk ${i + 1}/${chunks.length}`,
            '',
            formatMemoryMd(chunks[i]),
            '',
          ].join('\n')
          files.set(`tags/${keySlug}/${valueSlug}-${i + 1}.md`, body)
        }
        indexLines.push(`- **${value}** — ${items.length} entries across ${chunks.length} chunks`)
        for (let i = 0; i < chunks.length; i++) {
          indexLines.push(`  - [chunk ${i + 1}](${keySlug}/${valueSlug}-${i + 1}.md)`)
        }
      }
    }

    indexLines.push('')
    files.set(`tags/${keySlug}.md`, `${indexLines.join('\n')}\n`)
  }

  return files
}

function buildPatternsFile(
  patterns: {
    name: string
    description: string
    locations?: string[]
    category?: string
    confidence?: number
  }[],
  antiPatterns: {
    issue: string
    suggestion: string
    files?: string[]
    reasoning?: string
    severity?: string
    confidence?: number
  }[]
): string | null {
  if (patterns.length === 0 && antiPatterns.length === 0) return null
  const lines: string[] = ['# Patterns (inferred)', '']
  if (patterns.length > 0) {
    lines.push('## Patterns')
    for (const p of patterns) {
      const loc =
        p.locations && p.locations.length > 0 ? ` — ${p.locations.slice(0, 3).join(', ')}` : ''
      const cat = p.category ? ` _[${p.category}]_` : ''
      lines.push(`- **${p.name}**${cat}: ${p.description}${loc}`)
    }
    lines.push('')
  }
  if (antiPatterns.length > 0) {
    lines.push('## Anti-patterns')
    for (const a of antiPatterns) {
      const file = a.files && a.files.length > 0 ? ` (${a.files[0]})` : ''
      const sev = a.severity ? ` _[${a.severity}]_` : ''
      lines.push(`- **${a.issue}**${sev}${file} — ${a.suggestion}`)
      if (a.reasoning) lines.push(`  - Why: ${a.reasoning}`)
    }
    lines.push('')
  }
  lines.push('> Source: `prjct sync` analysis. Provenance: INFR.')
  return `${lines.join('\n')}\n`
}

function buildArchitectureFile(a: LLMAnalysis): string | null {
  const { architecture, conventions } = a
  const hasArch =
    architecture &&
    (architecture.style || architecture.insights?.length || architecture.domains?.length)
  if (!hasArch && (!conventions || conventions.length === 0)) return null

  const lines: string[] = ['# Architecture', '']
  if (architecture?.style) {
    lines.push(`**Style**: ${architecture.style}`, '')
  }
  if (architecture?.domains && architecture.domains.length > 0) {
    lines.push('## Domains')
    for (const d of architecture.domains) lines.push(`- ${d}`)
    lines.push('')
  }
  if (architecture?.insights && architecture.insights.length > 0) {
    lines.push('## Insights')
    for (const i of architecture.insights) lines.push(`- ${i}`)
    lines.push('')
  }
  if (conventions && conventions.length > 0) {
    lines.push('## Conventions')
    for (const c of conventions) {
      const ex = c.example ? ` — \`${c.example}\`` : ''
      lines.push(`- **${c.category}**: ${c.rule}${ex}`)
    }
    lines.push('')
  }
  lines.push('> Source: `prjct sync` LLM analysis.')
  return `${lines.join('\n')}\n`
}

function buildTechDebtFile(a: LLMAnalysis): string | null {
  const { techDebt, riskAreas, refactorSuggestions } = a
  const total =
    (techDebt?.length ?? 0) + (riskAreas?.length ?? 0) + (refactorSuggestions?.length ?? 0)
  if (total === 0) return null

  const lines: string[] = ['# Tech debt, risks & refactors', '']
  if (techDebt && techDebt.length > 0) {
    lines.push('## Tech debt')
    for (const t of techDebt) {
      lines.push(
        `- **${t.description}** _[${t.priority}, ${t.effort}]_ — ${t.area}. Impact: ${t.impact}`
      )
    }
    lines.push('')
  }
  if (riskAreas && riskAreas.length > 0) {
    lines.push('## Risk areas')
    for (const r of riskAreas) {
      lines.push(`- **${r.path}** _[${r.severity}]_ — ${r.reason}. Risk: ${r.risk}`)
    }
    lines.push('')
  }
  if (refactorSuggestions && refactorSuggestions.length > 0) {
    lines.push('## Refactor suggestions')
    for (const r of refactorSuggestions) {
      const files = r.files && r.files.length > 0 ? ` (${r.files.slice(0, 3).join(', ')})` : ''
      lines.push(`- **${r.description}** _[${r.effort}]_${files} — ${r.benefit}`)
    }
    lines.push('')
  }
  lines.push('> Source: `prjct sync` LLM analysis.')
  return `${lines.join('\n')}\n`
}

function buildInsightsFile(a: LLMAnalysis): string | null {
  if (!a.projectInsights || a.projectInsights.length === 0) return null
  const lines: string[] = ['# Project insights', '']
  for (const i of a.projectInsights) lines.push(`- ${i}`)
  lines.push('', '> Source: `prjct sync` LLM analysis.')
  return `${lines.join('\n')}\n`
}

// =============================================================================
// Analysis folder — one file per concept, deduped across history
// =============================================================================
//
// The vault is a RAG for both an LLM and a human, so we organize by
// *what the thing is*, not by *when it was captured*. Each pattern,
// anti-pattern, tech-debt item, risk area, refactor, and project insight
// lives in its own markdown file named after the concept itself. Files
// are deduped across all historical analyses (same concept → same file,
// updated with first-seen / last-seen metadata). The only time-ordered
// artifact is `analysis/history.md`, and it only records *changes* —
// not a full dump per save.

type ArchiveEntry = {
  id: number
  status: string
  commitHash: string | null
  analyzedAt: string
  supersededAt: string | null
  analysis: LLMAnalysis
}

type ConceptKind = 'pattern' | 'anti-pattern' | 'tech-debt' | 'risk-area' | 'refactor' | 'insight'

const CONCEPT_FOLDERS: Record<ConceptKind, string> = {
  pattern: 'patterns',
  'anti-pattern': 'anti-patterns',
  'tech-debt': 'tech-debt',
  'risk-area': 'risk-areas',
  refactor: 'refactors',
  insight: 'insights',
}

function analysisDateOnly(entry: ArchiveEntry): string {
  const m = (entry.analyzedAt || '').match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : 'undated'
}

/**
 * Build a fat aggregate keyed by (kind, name) across every historical
 * analysis. For each concept we track the latest body, the list of
 * analyses that mentioned it, and first/last-seen dates.
 */
type ConceptRecord = {
  kind: ConceptKind
  name: string
  slug: string
  latestBody: Record<string, unknown>
  firstSeen: string
  lastSeen: string
  seenIn: Array<{ analysisId: number; date: string; commit: string | null }>
  stillActive: boolean
}

function conceptKey(kind: ConceptKind, name: string): string {
  return `${kind}::${name.trim().toLowerCase()}`
}

function collectConcepts(entries: ArchiveEntry[]): Map<string, ConceptRecord> {
  const out = new Map<string, ConceptRecord>()

  // Walk oldest → newest so lastSeen / latestBody end up on the newest
  // occurrence. `entries` arrives newest-first from the DB.
  const ordered = [...entries].reverse()

  const touch = (
    kind: ConceptKind,
    name: string,
    body: Record<string, unknown>,
    entry: ArchiveEntry
  ): void => {
    if (!name || !name.trim()) return
    const key = conceptKey(kind, name)
    const date = analysisDateOnly(entry)
    const existing = out.get(key)
    if (existing) {
      existing.lastSeen = date
      existing.latestBody = body
      existing.seenIn.push({ analysisId: entry.id, date, commit: entry.commitHash })
      if (entry.status === 'active') existing.stillActive = true
      return
    }
    out.set(key, {
      kind,
      name: name.trim(),
      slug: slugify(name).slice(0, 60) || 'unnamed',
      latestBody: body,
      firstSeen: date,
      lastSeen: date,
      seenIn: [{ analysisId: entry.id, date, commit: entry.commitHash }],
      stillActive: entry.status === 'active',
    })
  }

  for (const entry of ordered) {
    const a = entry.analysis
    for (const p of a.patterns ?? [])
      touch('pattern', p.name, p as unknown as Record<string, unknown>, entry)
    for (const p of a.antiPatterns ?? [])
      touch('anti-pattern', p.issue, p as unknown as Record<string, unknown>, entry)
    for (const t of a.techDebt ?? [])
      touch('tech-debt', t.description, t as unknown as Record<string, unknown>, entry)
    for (const r of a.riskAreas ?? [])
      touch('risk-area', r.path, r as unknown as Record<string, unknown>, entry)
    for (const r of a.refactorSuggestions ?? [])
      touch('refactor', r.description, r as unknown as Record<string, unknown>, entry)
    for (const i of a.projectInsights ?? []) touch('insight', i, { description: i }, entry)
  }

  // Disambiguate slug collisions across different concept names that
  // slugify to the same string. Within a concept kind only.
  const seenSlugs = new Map<string, Set<string>>()
  for (const rec of out.values()) {
    const folder = CONCEPT_FOLDERS[rec.kind]
    let set = seenSlugs.get(folder)
    if (!set) {
      set = new Set()
      seenSlugs.set(folder, set)
    }
    let candidate = rec.slug
    let n = 2
    while (set.has(candidate)) {
      candidate = `${rec.slug}-${n}`
      n += 1
    }
    rec.slug = candidate
    set.add(candidate)
  }

  return out
}

function buildConceptFile(rec: ConceptRecord): string {
  const lines: string[] = []
  const body = rec.latestBody
  const seenDates = [...new Set(rec.seenIn.map((s) => s.date))]

  lines.push('---')
  lines.push(`type: ${rec.kind}`)
  lines.push(`name: ${JSON.stringify(rec.name)}`)
  lines.push(`firstSeen: ${rec.firstSeen}`)
  lines.push(`lastSeen: ${rec.lastSeen}`)
  lines.push(`seenIn: ${rec.seenIn.length}`)
  lines.push(`stillActive: ${rec.stillActive}`)
  lines.push(`tags: [${rec.kind}]`)
  lines.push('---')
  lines.push('')
  lines.push(`# ${rec.name}`)
  lines.push('')

  const desc = (body.description as string) || (body.reason as string) || (body.issue as string)
  if (desc && desc !== rec.name) {
    lines.push(desc)
    lines.push('')
  }

  // Per-kind salient fields. Keep terse — full history lives at the bottom.
  const detail: string[] = []
  if (body.severity) detail.push(`**Severity**: ${body.severity}`)
  if (body.priority) detail.push(`**Priority**: ${body.priority}`)
  if (body.effort) detail.push(`**Effort**: ${body.effort}`)
  if (body.impact) detail.push(`**Impact**: ${body.impact}`)
  if (body.benefit) detail.push(`**Benefit**: ${body.benefit}`)
  if (body.confidence !== undefined) detail.push(`**Confidence**: ${body.confidence}`)
  if (body.category) detail.push(`**Category**: ${body.category}`)
  if (body.area) detail.push(`**Area**: ${body.area}`)
  if (body.risk) detail.push(`**Risk**: ${body.risk}`)
  if (body.suggestion) detail.push(`**Suggestion**: ${body.suggestion}`)
  if (body.reasoning && body.reasoning !== desc) detail.push(`**Reasoning**: ${body.reasoning}`)
  if (detail.length > 0) {
    lines.push(...detail.map((d) => `- ${d}`))
    lines.push('')
  }

  const files = (body.files as string[]) || []
  const locations = (body.locations as string[]) || []
  const paths = [...new Set([...files, ...locations])]
  if (paths.length > 0) {
    lines.push('## Where')
    for (const p of paths) lines.push(`- \`${p}\``)
    lines.push('')
  }

  lines.push('## Seen in')
  lines.push(
    `First: ${rec.firstSeen} · Last: ${rec.lastSeen} · ${rec.seenIn.length} analysis run${rec.seenIn.length === 1 ? '' : 's'} (${seenDates.length} distinct date${seenDates.length === 1 ? '' : 's'})`
  )
  lines.push('')

  return `${lines.join('\n')}\n`
}

/**
 * Evolution log — one bullet per *change* across consecutive analyses.
 * When two adjacent analyses are identical by count + concept set we
 * collapse them so the log isn't a firehose of no-op saves.
 */
function buildHistoryFile(entries: ArchiveEntry[]): string {
  const lines: string[] = ['# Analysis evolution', '']
  lines.push(
    'One entry per analysis save where *something changed* (architecture, patterns, anti-patterns, tech debt, risks, refactors, or insights). Repeated saves with identical contents are collapsed.'
  )
  lines.push('')

  if (entries.length === 0) {
    lines.push('> No analyses saved yet. Run `prjct sync` to generate one.')
    return `${lines.join('\n')}\n`
  }

  const rowFor = (e: ArchiveEntry) => {
    const a = e.analysis
    return {
      arch: a.architecture?.style ?? '—',
      patterns: new Set((a.patterns ?? []).map((p) => p.name)),
      anti: new Set((a.antiPatterns ?? []).map((p) => p.issue)),
      debt: new Set((a.techDebt ?? []).map((t) => t.description)),
      risks: new Set((a.riskAreas ?? []).map((r) => r.path)),
      refactors: new Set((a.refactorSuggestions ?? []).map((r) => r.description)),
      insights: new Set(a.projectInsights ?? []),
    }
  }

  const diffNames = (
    prev: Set<string>,
    curr: Set<string>
  ): { added: string[]; removed: string[] } => {
    const added: string[] = []
    const removed: string[] = []
    for (const n of curr) if (!prev.has(n)) added.push(n)
    for (const n of prev) if (!curr.has(n)) removed.push(n)
    return { added, removed }
  }

  // Walk oldest → newest.
  const ordered = [...entries].reverse()
  let prev: ReturnType<typeof rowFor> | null = null
  const rows: string[] = []

  for (const e of ordered) {
    const curr = rowFor(e)
    if (prev === null) {
      rows.push(
        `- **${analysisDateOnly(e)}** — baseline captured (arch: ${curr.arch}, ${curr.patterns.size} patterns, ${curr.anti.size} anti, ${curr.debt.size} debt, ${curr.risks.size} risks, ${curr.refactors.size} refactors, ${curr.insights.size} insights).`
      )
      prev = curr
      continue
    }

    const parts: string[] = []
    if (prev.arch !== curr.arch) parts.push(`arch ${prev.arch} → ${curr.arch}`)
    for (const [label, field] of [
      ['pattern', 'patterns'],
      ['anti-pattern', 'anti'],
      ['tech-debt', 'debt'],
      ['risk', 'risks'],
      ['refactor', 'refactors'],
      ['insight', 'insights'],
    ] as const) {
      const d = diffNames(prev[field], curr[field])
      for (const n of d.added) parts.push(`+${label} "${n}"`)
      for (const n of d.removed) parts.push(`−${label} "${n}"`)
    }
    if (parts.length === 0) continue // collapse no-op saves

    rows.push(`- **${analysisDateOnly(e)}** — ${parts.join('; ')}.`)
    prev = curr
  }

  if (rows.length === 0) {
    lines.push('> No changes recorded yet.')
  } else {
    // Newest-first in the rendered output.
    lines.push(...rows.reverse())
  }
  lines.push('')
  return `${lines.join('\n')}\n`
}

function buildAnalysisIndex(concepts: Map<string, ConceptRecord>): string {
  const byKind = new Map<ConceptKind, ConceptRecord[]>()
  for (const rec of concepts.values()) {
    const bucket = byKind.get(rec.kind) ?? []
    bucket.push(rec)
    byKind.set(rec.kind, bucket)
  }

  const lines: string[] = ['# Analysis', '']
  lines.push(
    'One file per concept from `prjct sync`. Files are deduped across history — the same pattern or risk always lands at the same path, updated with first/last-seen dates.'
  )
  lines.push('')
  lines.push('See also: [[history]] for the chronological change log.')
  lines.push('')

  const kindOrder: ConceptKind[] = [
    'pattern',
    'anti-pattern',
    'tech-debt',
    'risk-area',
    'refactor',
    'insight',
  ]

  for (const kind of kindOrder) {
    const bucket = byKind.get(kind)
    if (!bucket || bucket.length === 0) continue
    const folder = CONCEPT_FOLDERS[kind]
    const activeCount = bucket.filter((r) => r.stillActive).length
    lines.push(`## ${folder} (${activeCount} active / ${bucket.length} total)`)
    lines.push('')
    // Active first, then historical.
    const sorted = [...bucket].sort((a, b) => {
      if (a.stillActive !== b.stillActive) return a.stillActive ? -1 : 1
      return a.lastSeen > b.lastSeen ? -1 : 1
    })
    for (const rec of sorted) {
      const marker = rec.stillActive ? '' : ' _(historical)_'
      lines.push(`- [[${folder}/${rec.slug}|${rec.name}]]${marker}`)
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function buildAnalysisArchiveFiles(entries: ArchiveEntry[]): Map<string, string> {
  const out = new Map<string, string>()
  if (entries.length === 0) return out

  const concepts = collectConcepts(entries)
  for (const rec of concepts.values()) {
    const folder = CONCEPT_FOLDERS[rec.kind]
    out.set(`analysis/${folder}/${rec.slug}.md`, buildConceptFile(rec))
  }
  out.set('analysis/index.md', buildAnalysisIndex(concepts))
  out.set('analysis/history.md', buildHistoryFile(entries))
  return out
}

function buildIndexFile(args: {
  ships: ShippedFeature[]
  memoryTypeCounts: Map<string, number>
  tagKeyCounts: Map<string, number>
  patternsCount: number
  antiPatternsCount: number
  llmAnalysis: LLMAnalysis | null
  archiveCount: number
}): string {
  const { ships, memoryTypeCounts, tagKeyCounts, patternsCount, antiPatternsCount, llmAnalysis } =
    args
  const lines: string[] = [
    '# Project Wiki (generated)',
    '',
    'Agent-crawlable snapshot of project memory. Regenerated on `prjct ship` and `prjct remember`.',
    'Read directly with Read/Glob — no CLI round-trip needed.',
    '',
    '> Auto-generated. Your own notes under `.prjct/wiki/` are preserved.',
    '',
  ]

  if (ships.length > 0) {
    lines.push('## Ships')
    for (const ship of ships)
      lines.push(`- [${ship.name}](ships/${slugify(ship.name)}.md) — ${ship.shippedAt}`)
    lines.push('')
  }

  if (memoryTypeCounts.size > 0) {
    lines.push('## Memory by type')
    for (const [type, count] of memoryTypeCounts) {
      lines.push(`- [${type}](memory/${type}.md) — ${count} entries`)
    }
    lines.push('')
  }

  if (tagKeyCounts.size > 0) {
    lines.push('## Memory by tag')
    for (const [key, count] of tagKeyCounts) {
      lines.push(`- [${key}](tags/${slugify(key)}.md) — ${count} entries`)
    }
    lines.push('')
  }

  if (patternsCount > 0 || antiPatternsCount > 0 || llmAnalysis) {
    lines.push('## Inferred')
    if (patternsCount > 0 || antiPatternsCount > 0) {
      lines.push(
        `- [patterns](patterns.md) — ${patternsCount} patterns, ${antiPatternsCount} anti-patterns`
      )
    }
    if (llmAnalysis) {
      const archHas =
        llmAnalysis.architecture?.style ||
        llmAnalysis.architecture?.insights?.length ||
        llmAnalysis.conventions?.length
      if (archHas) {
        lines.push(
          `- [architecture](architecture.md) — ${llmAnalysis.architecture?.style ?? '—'}, ${llmAnalysis.conventions?.length ?? 0} conventions`
        )
      }
      const debtCount =
        (llmAnalysis.techDebt?.length ?? 0) +
        (llmAnalysis.riskAreas?.length ?? 0) +
        (llmAnalysis.refactorSuggestions?.length ?? 0)
      if (debtCount > 0) {
        lines.push(
          `- [tech-debt](tech-debt.md) — ${llmAnalysis.techDebt?.length ?? 0} debt items, ${llmAnalysis.riskAreas?.length ?? 0} risks, ${llmAnalysis.refactorSuggestions?.length ?? 0} refactors`
        )
      }
      if (llmAnalysis.projectInsights && llmAnalysis.projectInsights.length > 0) {
        lines.push(
          `- [insights](insights.md) — ${llmAnalysis.projectInsights.length} project insights`
        )
      }
    }
    if (args.archiveCount > 0) {
      lines.push(
        `- [analysis drill-down](analysis/index.md) — ${args.archiveCount} concepts (patterns, anti-patterns, tech-debt, risks, refactors, insights) + [history](analysis/history.md)`
      )
    }
    lines.push('')
  }

  if (
    ships.length === 0 &&
    memoryTypeCounts.size === 0 &&
    patternsCount === 0 &&
    antiPatternsCount === 0
  ) {
    lines.push(
      '> No ships, memory, or patterns yet. Run `prjct remember`, `prjct ship`, or `prjct sync`.'
    )
  }

  return `${lines.join('\n')}\n`
}

// =============================================================================
// Disk I/O + manifest diffing
// =============================================================================

async function readManifest(root: string): Promise<Manifest> {
  try {
    const raw = await fs.readFile(path.join(root, MANIFEST_FILE), 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') return parsed as Manifest
    return {}
  } catch {
    return {}
  }
}

async function writeFile(root: string, relPath: string, body: string): Promise<void> {
  const fullPath = path.join(root, relPath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, body, 'utf-8')
}

async function removeFile(root: string, relPath: string): Promise<void> {
  try {
    await fs.rm(path.join(root, relPath), { force: true })
  } catch {
    // non-critical
  }
}

// =============================================================================
// Public API
// =============================================================================

export async function generateWiki(
  projectPath: string,
  projectId: string
): Promise<{
  wikiRoot: string
  filesWritten: number
  filesSkipped: number
  filesRemoved: number
}> {
  // Resolve vault location (new default is ~/Documents/prjct/<slug>/);
  // pre-2.2.0 projects get their old `.prjct/wiki/` migrated in-place.
  await migrateWikiLocationIfNeeded(projectPath)
  const config = await configManager.readConfig(projectPath).catch(() => null)
  const wikiRoot = pathManager.getWikiPath(projectPath, config?.vaultPath)
  const generatedRoot = path.join(wikiRoot, GENERATED_SUBDIR)
  await fs.mkdir(generatedRoot, { recursive: true })

  // --- Gather sources ---
  const [ships, entries, analysis, llmAnalysis] = await Promise.all([
    shippedStorage.getAll(projectId),
    Promise.resolve(projectMemory.recall(projectId, { limit: 5000 })),
    analysisStorage.getActive(projectId).catch(() => null),
    Promise.resolve(llmAnalysisStorage.getActive(projectId)).catch(() => null),
  ])
  const declared = entries.filter((e) => e.type !== 'shipped')

  // --- Build all file bodies in memory ---
  const files = new Map<string, string>()

  for (const ship of ships) {
    files.set(`ships/${slugify(ship.name)}.md`, formatShipBody(ship))
  }
  for (const [rel, body] of buildMemoryFiles(declared)) files.set(rel, body)
  for (const [rel, body] of buildTagFiles(declared)) files.set(rel, body)

  // Prefer LLM analysis (richer fields) when available, fallback to heuristic.
  const patterns = llmAnalysis?.patterns ?? analysis?.patterns ?? []
  const antiPatterns = llmAnalysis?.antiPatterns ?? analysis?.antiPatterns ?? []
  const patternsBody = buildPatternsFile(patterns, antiPatterns)
  if (patternsBody) files.set('patterns.md', patternsBody)

  // LLM-only sections: architecture, tech debt, risks, refactors, conventions,
  // project insights. Each lands in its own markdown file so the vault stays
  // browsable and agents can fetch them individually.
  if (llmAnalysis) {
    const archBody = buildArchitectureFile(llmAnalysis)
    if (archBody) files.set('architecture.md', archBody)

    const debtBody = buildTechDebtFile(llmAnalysis)
    if (debtBody) files.set('tech-debt.md', debtBody)

    const insightsBody = buildInsightsFile(llmAnalysis)
    if (insightsBody) files.set('insights.md', insightsBody)
  }

  // Append-only analysis archive: one file per historical sync. Filenames
  // encode the analyzedAt timestamp + short commit so each run produces a
  // new, unique path. The manifest-diff pass never rewrites an existing
  // snapshot because its body is deterministic in the entry — this is how
  // the vault preserves trace across overwrites of the top-level
  // architecture.md / tech-debt.md / insights.md.
  const archiveEntries = llmAnalysisStorage.getAllFull(projectId)
  for (const [rel, body] of buildAnalysisArchiveFiles(archiveEntries)) files.set(rel, body)

  const memoryTypeCounts = new Map<string, number>()
  for (const e of declared) memoryTypeCounts.set(e.type, (memoryTypeCounts.get(e.type) ?? 0) + 1)
  const tagKeyCounts = new Map<string, number>()
  for (const e of declared) {
    for (const k of Object.keys(e.tags)) {
      tagKeyCounts.set(k, (tagKeyCounts.get(k) ?? 0) + 1)
    }
  }
  files.set(
    'index.md',
    buildIndexFile({
      ships,
      memoryTypeCounts,
      tagKeyCounts,
      patternsCount: patterns.length,
      antiPatternsCount: antiPatterns.length,
      llmAnalysis,
      // "Archive" used to mean per-save snapshots; now it's the concept
      // drill-down. Keep the same arg name so the signature stays stable
      // but count distinct concepts across history.
      archiveCount: collectConcepts(archiveEntries).size,
    })
  )

  // --- Diff against manifest ---
  const oldManifest = await readManifest(generatedRoot)
  const newManifest: Manifest = {}
  let filesWritten = 0
  let filesSkipped = 0
  let filesRemoved = 0

  for (const [rel, body] of files) {
    const hash = sha256(body)
    newManifest[rel] = hash
    if (oldManifest[rel] === hash) {
      filesSkipped++
      continue
    }
    await writeFile(generatedRoot, rel, body)
    filesWritten++
  }

  // Remove files that existed last run but no longer should.
  for (const oldRel of Object.keys(oldManifest)) {
    if (newManifest[oldRel]) continue
    await removeFile(generatedRoot, oldRel)
    filesRemoved++
  }

  // Persist new manifest (always rewrite — it's tiny).
  await writeFile(generatedRoot, MANIFEST_FILE, `${JSON.stringify(newManifest, null, 2)}\n`)

  // Top-level README pointer, written only if absent so user files aren't clobbered.
  const topReadmePath = path.join(wikiRoot, 'README.md')
  const topReadmeExists = await fs.stat(topReadmePath).then(
    () => true,
    () => false
  )
  if (!topReadmeExists) {
    await writeFile(
      wikiRoot,
      'README.md',
      `# Project Wiki\n\nOpen this folder as an Obsidian vault to browse project memory.\n\n- Auto-generated content lives in \`${GENERATED_SUBDIR}/\` — start at [${GENERATED_SUBDIR}/index.md](${GENERATED_SUBDIR}/index.md). Do not edit; it rebuilds on \`prjct ship\` / \`prjct remember\`.\n- Drop notes into \`captured/\` with frontmatter, then run \`prjct context wiki sync\` to ingest them into project memory. See [captured/README.md](captured/README.md).\n- Any other markdown you place here survives rebuilds.\n`
    )
    filesWritten++
  }

  // Seed the captured dropzone with a README so users who open the vault
  // in Obsidian discover the capture workflow. No-op if the README
  // already exists.
  await ensureCapturedReadme(projectPath)

  // Make the folder a one-click-open Obsidian vault: bootstrap a
  // minimal `.obsidian/` and register the path in Obsidian's vault
  // registry so `obsidian://open?vault=<slug>` works. Best-effort; if
  // Obsidian isn't installed, this quietly no-ops.
  await ensureObsidianVault(wikiRoot).catch(() => undefined)

  return { wikiRoot, filesWritten, filesSkipped, filesRemoved }
}

/**
 * Fire-and-forget wiki regen. In daemon mode the promise keeps running
 * after the CLI response is flushed. In raw CLI mode it still awaits,
 * since process.exit() would drop the pending promise. Detected via the
 * `PRJCT_IN_DAEMON` env var set by `core/daemon/daemon.ts` on startup.
 */
export async function regenerateWikiDeferred(
  projectPath: string,
  projectId: string
): Promise<void> {
  const inDaemon = process.env.PRJCT_IN_DAEMON === '1'
  if (inDaemon) {
    // Let the CLI response flush first, then run without blocking.
    setImmediate(() => {
      generateWiki(projectPath, projectId).catch(() => {
        // Non-critical — the next regen will recover.
      })
    })
    return
  }
  try {
    await generateWiki(projectPath, projectId)
  } catch {
    // Non-critical.
  }
}
