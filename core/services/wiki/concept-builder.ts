/**
 * Concept-level analysis vault. The vault is a RAG for both an LLM
 * and a human, so we organize by *what the thing is*, not *when it
 * was captured*. Each pattern, anti-pattern, tech-debt item, risk
 * area, refactor, and project insight lives in its own markdown file
 * named after the concept itself. Files are deduped across all
 * historical analyses (same concept → same file, updated with
 * first-seen / last-seen metadata). The only time-ordered artifact
 * is `analysis/history.md`, and it only records *changes* — not a
 * full dump per save.
 */

import {
  ANALYSIS_MAP_FILE,
  type ArchiveEntry,
  analysisDateOnly,
  CONCEPT_FOLDERS,
  type ConceptKind,
  type ConceptRecord,
  conceptKey,
  slugify,
  truncate,
} from './_shared'

/**
 * Build a fat aggregate keyed by (kind, name) across every historical
 * analysis. For each concept we track the latest body, the list of
 * analyses that mentioned it, and first/last-seen dates.
 */
export function collectConcepts(entries: ArchiveEntry[]): Map<string, ConceptRecord> {
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

  lines.push('---')
  lines.push('')
  lines.push(`See also: [analysis map](../analysis-map.md) · [change log](../history.md)`)
  lines.push('')

  return `${lines.join('\n')}\n`
}

/**
 * Evolution log — one bullet per *change* across consecutive analyses.
 * When two adjacent analyses are identical by count + concept set we
 * collapse them so the log isn't a firehose of no-op saves.
 */
function buildHistoryFile(entries: ArchiveEntry[], concepts: Map<string, ConceptRecord>): string {
  const lines: string[] = ['# Analysis evolution', '']
  lines.push(
    'One entry per analysis save where *something changed* (architecture, patterns, anti-patterns, tech debt, risks, refactors, or insights). Repeated saves with identical contents are collapsed.'
  )
  lines.push('')
  lines.push('See also: [analysis map](analysis-map.md) · [project context](../project-context.md)')
  lines.push('')

  if (entries.length === 0) {
    lines.push('> No analyses saved yet. Run `prjct sync` to generate one.')
    return `${lines.join('\n')}\n`
  }

  const linkFor = (kind: ConceptKind, name: string): string => {
    const rec = concepts.get(conceptKey(kind, name))
    const display = truncate(name, 80)
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
  lines.push('See also: [change log](history.md) · [project context](../project-context.md)')
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
    const sorted = [...bucket].sort((a, b) => {
      if (a.stillActive !== b.stillActive) return a.stillActive ? -1 : 1
      return a.lastSeen > b.lastSeen ? -1 : 1
    })
    for (const rec of sorted) {
      const marker = rec.stillActive ? '' : ' _(historical)_'
      lines.push(`- [${rec.name}](${folder}/${rec.slug}.md)${marker}`)
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

export function buildAnalysisArchiveFiles(entries: ArchiveEntry[]): Map<string, string> {
  const out = new Map<string, string>()
  if (entries.length === 0) return out

  const concepts = collectConcepts(entries)
  for (const rec of concepts.values()) {
    const folder = CONCEPT_FOLDERS[rec.kind]
    out.set(`analysis/${folder}/${rec.slug}.md`, buildConceptFile(rec))
  }
  out.set(ANALYSIS_MAP_FILE, buildAnalysisIndex(concepts))
  out.set('analysis/history.md', buildHistoryFile(entries, concepts))
  return out
}
