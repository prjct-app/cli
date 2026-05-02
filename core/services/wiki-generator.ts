/**
 * Context Export Generator — emit an agent-readable markdown map of the
 * project's memory + shipped history to the configured vault location
 * (default: `~/Documents/prjct/<slug>/_generated/`; see path-manager).
 *
 * Why: prjct already holds the answers (memories, patterns, ships). The
 * fastest way for a subagent to read them is through its native Read/Glob
 * tools, not a CLI round-trip into SQLite. A static markdown tree eats
 * zero tokens until the agent opens the specific file it cares about.
 *
 * Obsidian compatibility is a side effect, not the design goal — the
 * export happens to be a valid Obsidian vault (see `obsidian-vault.ts`
 * for the auto-register helper), but no agent or workflow requires
 * Obsidian to be installed.
 *
 * Regenerated on `prjct remember`, `prjct capture`, `prjct ship`,
 * `prjct sync`, and the SessionStart / Stop hooks. Regeneration is
 * incremental (hash-per-file manifest) so the common case — one new
 * memory entry touching 1-2 files — rewrites those 1-2 files instead of
 * the whole tree.
 *
 * Output layout (under the vault root):
 *   <vault>/
 *     captured/                       — user-writable inbox (ingested by Stop hook)
 *     _generated/                     — regenerated; do not hand-edit
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
import { formatMemoryMd, type MemoryEntry, projectMemory } from '../memory/project-memory'
import { analysisStorage } from '../storage/analysis-storage'
import { prjctDb } from '../storage/database'
import llmAnalysisStorage from '../storage/llm-analysis-storage'
import shippedStorage from '../storage/shipped-storage'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import type { LLMAnalysis } from '../types/llm-analysis'
import type { ShippedFeature, WorkflowRule } from '../types/storage'
import { ensureObsidianVault } from './obsidian-vault'
import { ensureCapturedReadme } from './wiki-ingest'
import { resolveVaultRoot } from './wiki-migration'

// Generated output goes into a dedicated subdir so user notes placed in
// the vault root survive wiki rebuilds. Only this subdir gets touched.
const GENERATED_SUBDIR = '_generated'
const MANIFEST_FILE = '.manifest.json'

// Sidecar that lets us short-circuit when no input has changed since the
// last regen. Cheap fingerprint of (max event id, max analysis id, ship
// count + last_ship, CHANGELOG mtime, schema version). When this matches
// the on-disk value we skip the entire build/diff/sweep dance.
const FINGERPRINT_FILE = '.regen-fingerprint'
// v2: workflows visible in vault (M1b). Bumping invalidates v1 fingerprints
// so existing users get the new workflows/ subtree on next regen.
const REGEN_SCHEMA_VERSION = 2

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
// Releases folder — one file per CHANGELOG version
// =============================================================================
//
// Most projects have way more history in their CHANGELOG than in the
// young prjct SQLite tables. Parse `CHANGELOG.md` and emit one file
// per `## [version] - date` block so every release shows up in the
// vault as a discrete, addressable note.

type ReleaseEntry = {
  version: string
  date: string
  body: string
}

function parseChangelog(raw: string): ReleaseEntry[] {
  const out: ReleaseEntry[] = []
  const headerRe = /^## \[([^\]]+)\]\s*-\s*(\d{4}-\d{2}-\d{2})\s*$/
  const lines = raw.split('\n')

  let currentHeader: { version: string; date: string } | null = null
  let currentBody: string[] = []

  const flush = () => {
    if (!currentHeader) return
    out.push({
      version: currentHeader.version,
      date: currentHeader.date,
      body: currentBody.join('\n').trim(),
    })
    currentBody = []
  }

  for (const line of lines) {
    const match = line.match(headerRe)
    if (match) {
      flush()
      currentHeader = { version: match[1], date: match[2] }
      continue
    }
    if (currentHeader) currentBody.push(line)
  }
  flush()
  return out
}

function releaseSlug(version: string): string {
  // Versions like `2.0.0-alpha.12` → `v2.0.0-alpha.12`. Obsidian-safe.
  const cleaned = version.replace(/[^a-zA-Z0-9._-]+/g, '-')
  return `v${cleaned}`
}

function buildReleaseFile(
  entry: ReleaseEntry,
  prev: { entry: ReleaseEntry; slug: string } | null,
  next: { entry: ReleaseEntry; slug: string } | null
): string {
  const lines: string[] = []
  lines.push('---')
  lines.push(`type: release`)
  lines.push(`version: ${entry.version}`)
  lines.push(`date: ${entry.date}`)
  lines.push('tags: [release]')
  lines.push('---')
  lines.push('')
  lines.push(`# v${entry.version} — ${entry.date}`)
  lines.push('')

  // Nav at the top for quick hop-scrolling through release history.
  const navParts: string[] = []
  if (prev) navParts.push(`← [v${prev.entry.version}](${prev.slug}.md)`)
  navParts.push(`[releases index](index.md)`)
  if (next) navParts.push(`[v${next.entry.version}](${next.slug}.md) →`)
  lines.push(navParts.join(' · '))
  lines.push('')

  if (entry.body) {
    lines.push(entry.body)
    lines.push('')
  } else {
    lines.push('_No changelog body._')
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push(`[project wiki](../index.md) · [releases index](index.md)`)
  lines.push('')
  return `${lines.join('\n')}\n`
}

function buildReleasesIndex(entries: Array<{ entry: ReleaseEntry; slug: string }>): string {
  const lines: string[] = ['# Releases', '']
  lines.push(
    `${entries.length} version entr${entries.length === 1 ? 'y' : 'ies'} parsed from \`CHANGELOG.md\`. Newest first.`
  )
  lines.push('')
  lines.push('See also: [project wiki](../index.md)')
  lines.push('')
  lines.push('| Date | Version | Link |')
  lines.push('|---|---|---|')
  for (const { entry, slug } of entries) {
    lines.push(`| ${entry.date} | ${entry.version} | [v${entry.version}](${slug}.md) |`)
  }
  lines.push('')
  return `${lines.join('\n')}\n`
}

async function buildReleasesFiles(projectPath: string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const changelogPath = path.join(projectPath, 'CHANGELOG.md')
  let raw: string
  try {
    raw = await fs.readFile(changelogPath, 'utf-8')
  } catch {
    // No CHANGELOG — not every project has one; skip silently.
    return out
  }
  const entries = parseChangelog(raw)
  if (entries.length === 0) return out

  // Some CHANGELOGs repeat a version header (re-releases, authoring
  // mistakes). Disambiguate with a `-Nb` suffix on the slug so every
  // parsed entry survives — we'd rather show "v1.45.6-2b.md" than drop
  // half the history on the floor.
  const slugSeen = new Map<string, number>()
  const decoratedEntries: Array<{ entry: ReleaseEntry; slug: string }> = []
  for (const entry of entries) {
    const base = releaseSlug(entry.version)
    const count = slugSeen.get(base) ?? 0
    slugSeen.set(base, count + 1)
    const slug = count === 0 ? base : `${base}-${count + 1}b`
    decoratedEntries.push({ entry, slug })
  }

  // Two-pass so each release can carry prev/next nav pointing at the
  // decorated slugs. `entries` is newest-first → `prev` in nav means
  // "previous in reading order" (older).
  for (let i = 0; i < decoratedEntries.length; i++) {
    const curr = decoratedEntries[i]
    const newer = i > 0 ? decoratedEntries[i - 1] : null
    const older = i + 1 < decoratedEntries.length ? decoratedEntries[i + 1] : null
    out.set(`releases/${curr.slug}.md`, buildReleaseFile(curr.entry, older, newer))
  }
  out.set('releases/index.md', buildReleasesIndex(decoratedEntries))
  return out
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

  // Back-links. Without these the file is a leaf — it shows as an
  // orphan in Obsidian's graph view even though it's linked FROM the
  // index. Relative markdown paths (`../index.md`) resolve deterministically
  // regardless of the vault's Obsidian link-resolution mode.
  lines.push('---')
  lines.push('')
  lines.push(`See also: [analysis index](../index.md) · [change log](../history.md)`)
  lines.push('')

  return `${lines.join('\n')}\n`
}

/**
 * Evolution log — one bullet per *change* across consecutive analyses.
 * When two adjacent analyses are identical by count + concept set we
 * collapse them so the log isn't a firehose of no-op saves.
 *
 * Concept names in each bullet are linked to their own concept file
 * under the sibling folders (patterns/, anti-patterns/, etc.) so the
 * history is a navigation hub, not a text dump.
 */
function buildHistoryFile(entries: ArchiveEntry[], concepts: Map<string, ConceptRecord>): string {
  const lines: string[] = ['# Analysis evolution', '']
  lines.push(
    'One entry per analysis save where *something changed* (architecture, patterns, anti-patterns, tech debt, risks, refactors, or insights). Repeated saves with identical contents are collapsed.'
  )
  lines.push('')
  lines.push('See also: [analysis index](index.md) · [project wiki](../index.md)')
  lines.push('')

  if (entries.length === 0) {
    lines.push('> No analyses saved yet. Run `prjct sync` to generate one.')
    return `${lines.join('\n')}\n`
  }

  // Resolve a concept name to its file path (relative to history.md).
  const linkFor = (kind: ConceptKind, name: string): string => {
    const rec = concepts.get(conceptKey(kind, name))
    const display = name.length > 80 ? `${name.slice(0, 77)}…` : name
    if (!rec) return `"${display}"`
    const folder = CONCEPT_FOLDERS[rec.kind]
    return `[${display}](${folder}/${rec.slug}.md)`
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
    const fieldMap: Array<[string, keyof ReturnType<typeof rowFor>, ConceptKind]> = [
      ['pattern', 'patterns', 'pattern'],
      ['anti-pattern', 'anti', 'anti-pattern'],
      ['tech-debt', 'debt', 'tech-debt'],
      ['risk', 'risks', 'risk-area'],
      ['refactor', 'refactors', 'refactor'],
      ['insight', 'insights', 'insight'],
    ]
    for (const [label, field, kind] of fieldMap) {
      const d = diffNames(prev[field] as Set<string>, curr[field] as Set<string>)
      for (const n of d.added) parts.push(`+${label} ${linkFor(kind, n)}`)
      for (const n of d.removed) parts.push(`−${label} ${linkFor(kind, n)}`)
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
  lines.push('See also: [change log](history.md) · [project wiki](../index.md)')
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
      // Relative markdown link — resolves deterministically in Obsidian
      // regardless of vault root / link resolution mode.
      lines.push(`- [${rec.name}](${folder}/${rec.slug}.md)${marker}`)
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
  out.set('analysis/history.md', buildHistoryFile(entries, concepts))
  return out
}

/**
 * Render workflow_rules from SQLite as one Markdown file per `command`
 * under `_generated/workflows/<command>.md`. Read-only snapshot — to edit
 * a workflow, drop a `.md` with the same schema in the parent
 * `<vault>/workflows/` directory and the Stop hook ingests it (M1b
 * bidirectional pipeline).
 *
 * Format mirrors `prjct workflow <name>` CLI output: gates first, then
 * steps in sortOrder, then hooks/instructions. Each rule keeps its id so
 * the user can `prjct workflow rm <id>` from the file.
 */
function buildWorkflowFiles(rules: WorkflowRule[]): {
  files: Map<string, string>
  commandCount: number
} {
  const files = new Map<string, string>()
  if (rules.length === 0) return { files, commandCount: 0 }

  // Group by command (the workflow name: ship, task, sync, done, etc.)
  const byCommand = new Map<string, WorkflowRule[]>()
  for (const rule of rules) {
    const list = byCommand.get(rule.command) ?? []
    list.push(rule)
    byCommand.set(rule.command, list)
  }

  for (const [command, commandRules] of byCommand) {
    const enabled = commandRules.filter((r) => r.enabled)
    const gates = enabled.filter((r) => r.type === 'gate').sort((a, b) => a.sortOrder - b.sortOrder)
    const steps = enabled.filter((r) => r.type === 'step').sort((a, b) => a.sortOrder - b.sortOrder)
    const hooks = enabled.filter((r) => r.type === 'hook').sort((a, b) => a.sortOrder - b.sortOrder)
    const instructions = enabled
      .filter((r) => r.type === 'instruction')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const disabled = commandRules.filter((r) => !r.enabled)

    const lines: string[] = []
    lines.push('---')
    lines.push(`name: ${command}`)
    lines.push(`rules: ${commandRules.length}`)
    lines.push(`enabled: ${enabled.length}`)
    if (disabled.length > 0) lines.push(`disabled: ${disabled.length}`)
    lines.push('---')
    lines.push('')
    lines.push(`# Workflow: ${command}`)
    lines.push('')

    if (gates.length > 0) {
      lines.push('## Gates (must pass before workflow runs)')
      lines.push('')
      for (const r of gates) {
        const desc = r.description ? ` — ${r.description}` : ''
        const when = r.whenExpr ? ` _(when: \`${r.whenExpr}\`)_` : ''
        lines.push(`- \`${r.action}\`${desc}${when} — id: ${r.id}`)
      }
      lines.push('')
    }

    if (steps.length > 0) {
      lines.push('## Steps (run in order)')
      lines.push('')
      let i = 1
      for (const r of steps) {
        const desc = r.description ?? r.action
        lines.push(`${i}. **${desc}** — \`${r.action}\` (id: ${r.id})`)
        i += 1
      }
      lines.push('')
    }

    if (hooks.length > 0) {
      lines.push('## Hooks')
      lines.push('')
      for (const r of hooks) {
        const desc = r.description ? ` — ${r.description}` : ''
        const pos = r.position ? ` _(position: ${r.position})_` : ''
        lines.push(`- \`${r.action}\`${desc}${pos} — id: ${r.id}`)
      }
      lines.push('')
    }

    if (instructions.length > 0) {
      lines.push('## Instructions')
      lines.push('')
      for (const r of instructions) {
        const desc = r.description ? ` — ${r.description}` : ''
        lines.push(`- \`${r.action}\`${desc} — id: ${r.id}`)
      }
      lines.push('')
    }

    if (disabled.length > 0) {
      lines.push('## Disabled rules')
      lines.push('')
      for (const r of disabled) {
        const desc = r.description ? ` — ${r.description}` : ''
        lines.push(`- (${r.type}) \`${r.action}\`${desc} — id: ${r.id}`)
      }
      lines.push('')
    }

    lines.push('---')
    lines.push('')
    lines.push(
      `> Edit this workflow: drop a Markdown file at \`<vault>/workflows/${command}.md\` (NOT under \`_generated/\`) with the same frontmatter + sections. The Stop hook ingests it and overrides these rules.`
    )

    files.set(`workflows/${command}.md`, `${lines.join('\n')}\n`)
  }

  // Index file listing all workflows
  const indexLines: string[] = ['# Workflows', '']
  indexLines.push(
    'Workflow definitions stored in SQLite, rendered as Markdown for inspection. To edit, see the per-workflow page.'
  )
  indexLines.push('')
  for (const [command, commandRules] of byCommand) {
    const enabled = commandRules.filter((r) => r.enabled).length
    indexLines.push(`- [${command}](${command}.md) — ${enabled} active rule(s)`)
  }
  files.set('workflows/index.md', `${indexLines.join('\n')}\n`)

  return { files, commandCount: byCommand.size }
}

function buildIndexFile(args: {
  ships: ShippedFeature[]
  memoryTypeCounts: Map<string, number>
  tagKeyCounts: Map<string, number>
  patternsCount: number
  antiPatternsCount: number
  llmAnalysis: LLMAnalysis | null
  archiveCount: number
  releaseCount: number
  workflowCount: number
}): string {
  const { ships, memoryTypeCounts, tagKeyCounts, patternsCount, antiPatternsCount, llmAnalysis } =
    args
  const lines: string[] = [
    '# Project context export (generated)',
    '',
    'Agent-readable snapshot of project memory. Regenerated on `prjct remember`, `prjct capture`,',
    '`prjct ship`, `prjct sync`, and the SessionStart / Stop hooks.',
    'Read directly with Read/Glob — no CLI round-trip needed.',
    '',
    '> ⚠️  **Snapshot, not source.** SQLite is the source of truth. Edits to files under',
    '> `_generated/` are silently overwritten on the next regen. To add memory, run',
    '> `prjct remember <type> "..."` or drop a markdown note in `../captured/` (parent directory)',
    '> with `type:` frontmatter — the Stop hook ingests it.',
    '',
  ]

  if (ships.length > 0) {
    lines.push('## Ships')
    for (const ship of ships)
      lines.push(`- [${ship.name}](ships/${slugify(ship.name)}.md) — ${ship.shippedAt}`)
    lines.push('')
  }

  if (args.releaseCount > 0) {
    lines.push('## Releases')
    lines.push(
      `- [releases/index](releases/index.md) — ${args.releaseCount} versions parsed from \`CHANGELOG.md\``
    )
    lines.push('')
  }

  if (args.workflowCount > 0) {
    lines.push('## Workflows')
    lines.push(
      `- [workflows/index](workflows/index.md) — ${args.workflowCount} workflow definition(s)`
    )
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

/**
 * Walk the generated tree and delete any .md file that isn't in the
 * new manifest. Catches iCloud duplicate artifacts (" 2.md") and any
 * stragglers from previous regens whose manifest got lost.
 *
 * Safe because `_generated/` is 100% generator-owned — user notes live
 * above it at the vault root and in `captured/`.
 */
async function sweepStaleFiles(root: string, keep: Manifest): Promise<number> {
  let removed = 0
  const walk = async (dir: string): Promise<void> => {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        // Prune empty directories — they accumulate after sweeps.
        try {
          const remaining = await fs.readdir(full)
          if (remaining.length === 0) await fs.rmdir(full)
        } catch {
          // Non-critical.
        }
        continue
      }
      if (!entry.name.endsWith('.md')) continue
      const rel = path.relative(root, full)
      if (keep[rel]) continue
      try {
        await fs.rm(full, { force: true })
        removed++
      } catch {
        // Non-critical.
      }
    }
  }
  await walk(root)
  return removed
}

/**
 * Cheap input fingerprint — single SQL query + one stat call. Bumping
 * REGEN_SCHEMA_VERSION invalidates every project's cache, which is the
 * intended escape hatch when the output format changes.
 */
async function computeRegenFingerprint(projectPath: string, projectId: string): Promise<string> {
  type FpRow = {
    max_event_id: number
    max_analysis_id: number
    ship_count: number
    last_ship: string | null
    workflow_count: number
    max_workflow_id: number
  }
  let row: FpRow | null = null
  try {
    row = prjctDb.get<FpRow>(
      projectId,
      `SELECT
         (SELECT COALESCE(MAX(id), 0) FROM events) AS max_event_id,
         (SELECT COALESCE(MAX(id), 0) FROM llm_analysis) AS max_analysis_id,
         (SELECT COUNT(*) FROM shipped_features) AS ship_count,
         (SELECT MAX(shipped_at) FROM shipped_features) AS last_ship,
         (SELECT COUNT(*) FROM workflow_rules) AS workflow_count,
         (SELECT COALESCE(MAX(id), 0) FROM workflow_rules) AS max_workflow_id`
    )
  } catch {
    // DB might not be initialised yet — use sentinel that triggers a real regen.
  }
  const e = row?.max_event_id ?? 0
  const a = row?.max_analysis_id ?? 0
  const s = row?.ship_count ?? 0
  const ls = row?.last_ship ?? ''
  const wc = row?.workflow_count ?? 0
  const wmax = row?.max_workflow_id ?? 0
  const changelogMtime = await fs
    .stat(path.join(projectPath, 'CHANGELOG.md'))
    .then((st) => Math.floor(st.mtimeMs))
    .catch(() => 0)
  return `v${REGEN_SCHEMA_VERSION}|e${e}|a${a}|s${s}|ls${ls}|c${changelogMtime}|w${wc}/${wmax}`
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
  const wikiRoot = await resolveVaultRoot(projectPath)
  const generatedRoot = path.join(wikiRoot, GENERATED_SUBDIR)
  await fs.mkdir(generatedRoot, { recursive: true })

  // Fast path: if no input has changed since the last successful regen,
  // skip the entire build/diff/sweep dance. Regen runs on every hook
  // fire (session-start, stop, remember, capture, ship, sync), so
  // short-circuiting here saves ~50ms per call on quiet sessions. The
  // manifest read keeps the `filesSkipped` contract honest for callers.
  const fingerprintPath = path.join(generatedRoot, FINGERPRINT_FILE)
  const newFingerprint = await computeRegenFingerprint(projectPath, projectId)
  const oldFingerprint = await fs.readFile(fingerprintPath, 'utf-8').catch(() => null)
  if (oldFingerprint === newFingerprint) {
    const manifest = await readManifest(generatedRoot)
    return {
      wikiRoot,
      filesWritten: 0,
      filesSkipped: Object.keys(manifest).length,
      filesRemoved: 0,
    }
  }

  // --- Gather sources ---
  const [ships, entries, analysis, llmAnalysis, workflowRules] = await Promise.all([
    shippedStorage.getAll(projectId),
    Promise.resolve(projectMemory.recall(projectId, { limit: 5000 })),
    analysisStorage.getActive(projectId).catch(() => null),
    Promise.resolve(llmAnalysisStorage.getActive(projectId)).catch(() => null),
    Promise.resolve(workflowRuleStorage.getAllRules(projectId)).catch(() => [] as WorkflowRule[]),
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

  // M1b: workflows visible in vault. Read-only snapshot from SQLite.
  // Bidirectional editing (drop a .md in <vault>/workflows/ → ingest)
  // happens via wiki-ingest in a separate commit.
  const workflowResult = buildWorkflowFiles(workflowRules)
  for (const [rel, body] of workflowResult.files) files.set(rel, body)
  const workflowCount = workflowResult.commandCount

  // Append-only analysis archive: one file per historical sync. Filenames
  // encode the analyzedAt timestamp + short commit so each run produces a
  // new, unique path. The manifest-diff pass never rewrites an existing
  // snapshot because its body is deterministic in the entry — this is how
  // the vault preserves trace across overwrites of the top-level
  // architecture.md / tech-debt.md / insights.md.
  const archiveEntries = llmAnalysisStorage.getAllFull(projectId)
  for (const [rel, body] of buildAnalysisArchiveFiles(archiveEntries)) files.set(rel, body)

  // Parse CHANGELOG.md (if present) so every release shows up in the
  // vault. This is usually the largest historical signal — the DB
  // tables (ships, memory, analysis) only cover what was recorded with
  // prjct, while CHANGELOG.md predates and outpaces the tool itself.
  const releasesMap = await buildReleasesFiles(projectPath)
  for (const [rel, body] of releasesMap) files.set(rel, body)
  // Exclude the index file from the count so the overview reads "181
  // releases" not "182 files".
  const releaseCount = releasesMap.size > 0 ? releasesMap.size - 1 : 0

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
      releaseCount,
      workflowCount,
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

  // Filesystem-level sweep. The manifest-diff above only catches files
  // the *previous run* also knew about; that misses two real cases:
  //   1. iCloud Drive (macOS) silently creates " 2.md" / " 3.md"
  //      duplicates when it thinks there's a sync collision. They
  //      accumulate as orphans and never enter our manifest.
  //   2. A lost manifest (deleted, partial write, user copied the
  //      vault from elsewhere) means oldManifest is empty and every
  //      stale file from previous regens survives.
  // Scan the whole generated tree, and drop any .md we didn't just
  // write. `_generated/` is 100% generated — anything in there that
  // isn't in newManifest is cruft by definition.
  const swept = await sweepStaleFiles(generatedRoot, newManifest)
  filesRemoved += swept

  // Persist new manifest (always rewrite — it's tiny).
  await writeFile(generatedRoot, MANIFEST_FILE, `${JSON.stringify(newManifest, null, 2)}\n`)

  // Stamp the fingerprint last — only after a successful regen — so a
  // crash mid-build leaves the previous fingerprint in place and forces
  // the next call to redo the work.
  await writeFile(generatedRoot, FINGERPRINT_FILE, newFingerprint)

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
