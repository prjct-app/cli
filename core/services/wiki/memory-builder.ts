/**
 * Memory + tag + ship file builders.
 *
 * Pure functions: take memory entries / shipped features in, return a
 * `{ relPath: body }` map ready for the orchestrator to diff against
 * the on-disk manifest. No I/O.
 *
 * Vault model (mem_3233 at graph scale): substantive memory types get
 * ONE note per entry (`memory/<type>/<slug>.md`) so Obsidian — whose
 * graph nodes are *files*, not block anchors — renders a connected web
 * of entries. Each note carries `aliases: [mem_N]` so `[[mem_N|title]]`
 * resolves regardless of the (human, content-derived) filename, and the
 * displayed label is always a legible title, never the `mem_N` DB key.
 */

import type { MemoryEntry } from '../../memory/entries'
import {
  deriveTitle,
  type FormatMemoryMdOptions,
  formatMemoryMd,
  linkifyMemRefs,
  MACHINE_TAG_KEYS,
} from '../../memory/format'
import type { ShippedFeature } from '../../types/storage'
import { chunkEntries, slugify } from './_shared'
import { isSignalEntry } from './signals-builder'

/**
 * Types rendered as their own per-entry note. Ephemeral GTD types
 * (`inbox`/`todo`/`idea`) stay aggregated — they churn and would just
 * add noise nodes — but still resolve via the index (block anchor).
 * Machine signals (`improvement-signal`, detector output) never get a
 * note regardless of type — they render on `signals.md` only.
 */
export const PER_ENTRY_TYPES: ReadonlySet<string> = new Set([
  'decision',
  'learning',
  'gotcha',
  'pattern',
  'anti-pattern',
  'fact',
  'insight',
  'spec',
  'feedback',
  'improvement-idea',
  'question',
  'source',
  'person',
  'retro',
])

/**
 * Tag keys that encode an entry→entry RELATION, not a category. These
 * must NOT spawn tag pages (that fragmented the graph into orphan
 * stubs); they become real wikilink edges in each note's `## Relations`
 * section instead.
 */
const RELATION_KEYS: ReadonlySet<string> = new Set([
  'relates',
  'resolves',
  'closes',
  'supersedes',
  'duplicates',
  'blocks',
  'depends',
  'corrects',
])

/**
 * Global `mem_N → type` and `mem_N → title` indexes across ALL entries
 * (not the recall-capped/deduped render set) so every cross-ref
 * resolves and shows a legible label. See
 * `projectMemory.allEntriesForIndex`.
 */
export function buildIndexMaps(allEntries: MemoryEntry[]): {
  idTypeIndex: Map<string, string>
  idTitleIndex: Map<string, string>
  idSlugIndex: Map<string, string>
  signalIds: Set<string>
} {
  const idTypeIndex = new Map<string, string>()
  const idTitleIndex = new Map<string, string>()
  const idSlugIndex = new Map<string, string>()
  const signalIds = new Set<string>()
  // SINGLE SOURCE OF TRUTH for per-entry note basenames. The link
  // target (linkifyMemRefs) and the emitted filename
  // (buildMemoryEntryNotes) MUST be byte-identical or the graph edge
  // breaks. Slugs are made vault-UNIQUE (global seen-set, not per-type)
  // so `[[<slug>|title]]` resolves unambiguously by basename. Order is
  // deterministic (allEntriesForIndex → id DESC).
  const usedSlugs = new Set<string>()
  for (const e of allEntries) {
    idTypeIndex.set(e.id, e.type)
    const title = deriveTitle(e)
    idTitleIndex.set(e.id, title)
    if (isSignalEntry(e)) {
      // Telemetry — anchored on signals.md, never a note of its own.
      signalIds.add(e.id)
      continue
    }
    if (PER_ENTRY_TYPES.has(e.type)) {
      let slug = slugify(title)
      if (usedSlugs.has(slug)) slug = `${slug}-${rowId(e.id)}`.slice(0, 80)
      usedSlugs.add(slug)
      idSlugIndex.set(e.id, slug)
    }
  }
  return { idTypeIndex, idTitleIndex, idSlugIndex, signalIds }
}

function vaultOpts(
  idTypeIndex: Map<string, string>,
  idTitleIndex: Map<string, string>,
  idSlugIndex: Map<string, string>,
  signalIds: Set<string>
): FormatMemoryMdOptions {
  return {
    vault: true,
    idTypeIndex,
    idTitleIndex,
    idSlugIndex,
    signalIds,
    perEntryTypes: PER_ENTRY_TYPES,
  }
}

/**
 * Shared vault linkify options built once from the FULL entry set —
 * so every builder (memory, tags, specs, signals) resolves `mem_N` refs
 * to the same slug-targeted, legible links (graph-visible, not alias-only).
 */
export function buildVaultOpts(allEntries: MemoryEntry[]): FormatMemoryMdOptions {
  const { idTypeIndex, idTitleIndex, idSlugIndex, signalIds } = buildIndexMaps(allEntries)
  return vaultOpts(idTypeIndex, idTitleIndex, idSlugIndex, signalIds)
}

export function formatShipBody(ship: ShippedFeature): string {
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

function rowId(id: string): string {
  return id.replace(/^mem[_-]/, '')
}

function dateOnly(iso: string): string {
  const m = (iso || '').match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

/**
 * Native Obsidian tag list (`tags: [topic/daemon, trap/lazy-rejection]`).
 * The previous YAML flow-map form was invisible to Obsidian — tags must
 * be a list of strings to power graph coloring/filtering and the tag
 * pane. Nested `key/value` syntax keeps the dimension browsable.
 * Machine bookkeeping and relation keys are excluded (relations are
 * wikilink edges; machine keys live in SQLite).
 */
function frontmatterTags(tags: Record<string, string>): string {
  const items: string[] = []
  for (const [k, v] of Object.entries(tags)) {
    if (MACHINE_TAG_KEYS.has(k) || RELATION_KEYS.has(k)) continue
    const key = slugify(k, 40)
    const value = slugify(String(v), 60)
    if (key === 'unnamed' || value === 'unnamed') continue
    items.push(`${key}/${value}`)
  }
  if (items.length === 0) return ''
  return `tags: [${items.join(', ')}]`
}

/**
 * `## Relations` edges from RELATION_KEYS tags. `mem_N` values become
 * wikilinks (the graph edge); non-mem values (e.g.
 * `resolves=improvement-signal`) are listed as plain context.
 */
function relationsSection(entry: MemoryEntry, opts: FormatMemoryMdOptions): string[] {
  const rels: string[] = []
  for (const [k, raw] of Object.entries(entry.tags)) {
    if (!RELATION_KEYS.has(k)) continue
    for (const v of String(raw)
      .split(/[\s,]+/)
      .filter(Boolean)) {
      if (/^mem[_-]\d+$/i.test(v)) {
        rels.push(`- ${k} ${linkifyMemRefs(v.replace('-', '_'), opts)}`)
      } else {
        rels.push(`- ${k} \`${v}\``)
      }
    }
  }
  if (rels.length === 0) return []
  return ['', '## Relations', ...rels]
}

/**
 * One note per substantive entry. Filename is the human slug; the
 * stable join key `mem_N` lives only in `aliases:` + a muted block
 * anchor so the CLI/grep and legacy `#^mem-N` refs still resolve.
 */
export function buildMemoryEntryNotes(
  entries: MemoryEntry[],
  opts: FormatMemoryMdOptions
): {
  files: Map<string, string>
  titleByType: Map<string, Array<{ id: string; title: string; slug: string }>>
} {
  const files = new Map<string, string>()
  const titleByType = new Map<string, Array<{ id: string; title: string; slug: string }>>()

  for (const e of entries) {
    if (!PER_ENTRY_TYPES.has(e.type) || isSignalEntry(e)) continue
    const title = deriveTitle(e)
    // Slug comes from the shared index (buildIndexMaps) so the filename
    // is byte-identical to every link target. Fallback only if an entry
    // somehow isn't in the index.
    const slug = opts.idSlugIndex?.get(e.id) ?? `${slugify(title)}-${rowId(e.id)}`.slice(0, 80)

    const created = dateOnly(e.rememberedAt)
    const fm: string[] = ['---', `aliases: [${JSON.stringify(e.id)}]`, `type: ${e.type}`]
    fm.push(`provenance: ${e.provenance}`)
    if (created) fm.push(`created: ${created}`)
    const ftags = frontmatterTags(e.tags)
    if (ftags) fm.push(ftags)
    fm.push('---')

    const body: string[] = [
      fm.join('\n'),
      '',
      `# ${e.type}: ${title}`,
      '',
      `> \`${e.id}\`  ^mem-${rowId(e.id)}`,
      '',
      linkifyMemRefs(e.content, opts).trim(),
    ]
    body.push(...relationsSection(e, opts))
    files.set(`memory/${e.type}/${slug}.md`, `${body.join('\n')}\n`)

    const bucket = titleByType.get(e.type) ?? []
    bucket.push({ id: e.id, title, slug })
    titleByType.set(e.type, bucket)
  }

  return { files, titleByType }
}

function groupByTagPair(entries: MemoryEntry[]): Map<string, Map<string, MemoryEntry[]>> {
  const byKey = new Map<string, Map<string, MemoryEntry[]>>()
  for (const entry of entries) {
    for (const [k, v] of Object.entries(entry.tags)) {
      // Relation tags are graph edges (see ## Relations), not categories.
      if (RELATION_KEYS.has(k)) continue
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

export function buildMemoryFiles(
  entries: MemoryEntry[],
  allEntries: MemoryEntry[] = entries
): Map<string, string> {
  // Substantive types → one note per entry + a `memory/<type>.md` MOC
  // that wikilinks every note (the hub node). Ephemeral types keep the
  // aggregated/chunked file. Machine signals are quarantined to
  // signals.md (built by the orchestrator) — without this gate the
  // graph drowned in hot-file/skill-miss telemetry nodes (45% of all
  // entries). Index maps are built from the FULL entry set so every
  // cross-ref resolves (Defect B).
  const files = new Map<string, string>()
  const { idTypeIndex, idTitleIndex, idSlugIndex, signalIds } = buildIndexMaps(allEntries)
  const opts = vaultOpts(idTypeIndex, idTitleIndex, idSlugIndex, signalIds)
  const knowledge = entries.filter((e) => !isSignalEntry(e))

  const byType = new Map<string, MemoryEntry[]>()
  for (const e of knowledge) {
    const bucket = byType.get(e.type) ?? []
    bucket.push(e)
    byType.set(e.type, bucket)
  }

  const { files: noteFiles, titleByType } = buildMemoryEntryNotes(knowledge, opts)
  for (const [rel, body] of noteFiles) files.set(rel, body)

  for (const [type, items] of byType) {
    if (PER_ENTRY_TYPES.has(type)) {
      // MOC: links every entry note by its real basename (slug) so the
      // graph draws the hub→note edge; label stays the legible title.
      const links = titleByType.get(type) ?? []
      const moc = [
        `# ${type.toUpperCase()}`,
        '',
        `_${links.length} ${links.length === 1 ? 'entry' : 'entries'} — newest first._`,
        '',
        ...links.map(({ slug, title }) => `- [[${slug}|${title.replace(/[[\]|]/g, '')}]]`),
        '',
      ]
      files.set(`memory/${type}.md`, `${moc.join('\n')}\n`)
      continue
    }

    // Ephemeral type — aggregated, chunked when large (legacy behavior).
    const chunks = chunkEntries(items)
    if (chunks.length === 1) {
      const body = [`# ${type.toUpperCase()}`, '', formatMemoryMd(items, opts), ''].join('\n')
      files.set(`memory/${type}.md`, body)
      continue
    }
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
        formatMemoryMd(chunks[i], opts),
        '',
      ].join('\n')
      files.set(`memory/${chunkRel}`, body)
      indexLines.push(`- [chunk ${i + 1}](${chunkRel}) — ${chunks[i].length} entries`)
    }
    files.set(`memory/${type}.md`, `${indexLines.join('\n')}\n`)
  }

  return files
}

/**
 * Tag keys that don't deserve a browsable page: machine bookkeeping
 * (MACHINE_TAG_KEYS — hashes, counters, session ids) — their values are
 * opaque noise that once spawned hundreds of vault pages nobody reads.
 * Human dimensions (topic, type, pr, file, domain, …) get an index page.
 */
const NOISE_TAG_KEYS: ReadonlySet<string> = MACHINE_TAG_KEYS

/** Wikilink for one entry: the note basename when it has its own note,
 *  the aggregated file's block anchor otherwise. */
function entryLink(e: MemoryEntry, opts: FormatMemoryMdOptions): string {
  const title = (opts.idTitleIndex?.get(e.id) ?? deriveTitle(e)).replace(/[[\]|]/g, '')
  const slug = opts.idSlugIndex?.get(e.id)
  if (slug) return `[[${slug}|${title}]]`
  return `[[${e.type}#^mem-${rowId(e.id)}|${title}]]`
}

export function buildTagFiles(
  entries: MemoryEntry[],
  allEntries: MemoryEntry[] = entries
): Map<string, string> {
  // One LINK-ONLY index page per tag key (`tags/<key>.md`): values as
  // sections, entries as wikilinks. The old model emitted a page per
  // tag PAIR with every entry's full content copied in — 54% of vault
  // files were duplicated-content tag pages, and every one was a noise
  // node in the graph. Relation tags are excluded (graph edges, not
  // categories — Defect C); machine keys are excluded (hash sprawl);
  // machine-signal entries are excluded (they live on signals.md).
  const files = new Map<string, string>()
  const { idTypeIndex, idTitleIndex, idSlugIndex, signalIds } = buildIndexMaps(allEntries)
  const opts = vaultOpts(idTypeIndex, idTitleIndex, idSlugIndex, signalIds)
  const byPair = groupByTagPair(entries.filter((e) => !isSignalEntry(e)))

  const keyIndexLines = [`# Tags`, '']
  const sortedKeys = [...byPair.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  for (const [key, byValue] of sortedKeys) {
    if (NOISE_TAG_KEYS.has(key)) continue
    // A dimension used once is not a browsable dimension — a 1-entry
    // page is just another orphan node. The entry stays reachable via
    // its type MOC and its frontmatter tag.
    const total = [...byValue.values()].reduce((n, items) => n + items.length, 0)
    if (total < 2) continue
    const keySlug = slugify(key)
    const lines = [`# Tag: ${key}`, '']
    const sortedValues = [...byValue.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    let entryCount = 0
    for (const [value, items] of sortedValues) {
      lines.push(`## ${value}`, '')
      for (const item of items) lines.push(`- ${entryLink(item, opts)}`)
      lines.push('')
      entryCount += items.length
    }
    files.set(`tags/${keySlug}.md`, `${lines.join('\n')}\n`)
    // Path-qualified target: a bare [[topic]] could collide with an
    // entry note that happens to slug to the same basename.
    keyIndexLines.push(
      `- [[tags/${keySlug}|${key}]] — ${sortedValues.length} values, ${entryCount} entries`
    )
  }

  if (files.size > 0) {
    keyIndexLines.push('')
    files.set('tags.md', `${keyIndexLines.join('\n')}\n`)
  }
  return files
}
