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

import {
  deriveTitle,
  type FormatMemoryMdOptions,
  formatMemoryMd,
  linkifyMemRefs,
  type MemoryEntry,
} from '../../memory/project-memory'
import type { ShippedFeature } from '../../types/storage'
import { chunkEntries, slugify } from './_shared'

/**
 * Types rendered as their own per-entry note. Ephemeral GTD types
 * (`inbox`/`todo`/`idea`) stay aggregated — they churn and would just
 * add noise nodes — but still resolve via the index (block anchor).
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
  'improvement-signal',
  'question',
  'source',
  'person',
])

/**
 * Tag keys that encode an entry→entry RELATION, not a category. These
 * must NOT spawn `tags/<rel>/<value>.md` pages (that fragmented the
 * graph into orphan stubs); they become real wikilink edges in each
 * note's `## Relations` section instead.
 */
const RELATION_KEYS: ReadonlySet<string> = new Set([
  'relates',
  'resolves',
  'closes',
  'supersedes',
  'duplicates',
  'blocks',
  'depends',
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
} {
  const idTypeIndex = new Map<string, string>()
  const idTitleIndex = new Map<string, string>()
  for (const e of allEntries) {
    idTypeIndex.set(e.id, e.type)
    idTitleIndex.set(e.id, deriveTitle(e))
  }
  return { idTypeIndex, idTitleIndex }
}

function vaultOpts(
  idTypeIndex: Map<string, string>,
  idTitleIndex: Map<string, string>
): FormatMemoryMdOptions {
  return { vault: true, idTypeIndex, idTitleIndex, perEntryTypes: PER_ENTRY_TYPES }
}

/**
 * Shared vault linkify options built once from the FULL entry set —
 * so every builder (memory, tags, specs) resolves `mem_N` refs to the
 * same legible alias links instead of dangling pointers.
 */
export function buildVaultOpts(allEntries: MemoryEntry[]): FormatMemoryMdOptions {
  const { idTypeIndex, idTitleIndex } = buildIndexMaps(allEntries)
  return vaultOpts(idTypeIndex, idTitleIndex)
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

/** YAML flow map of tags with quoted values; '' when no tags. */
function frontmatterTags(tags: Record<string, string>): string {
  const pairs = Object.entries(tags)
  if (pairs.length === 0) return ''
  const body = pairs.map(([k, v]) => `${k}: ${JSON.stringify(String(v))}`).join(', ')
  return `tags: { ${body} }`
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
  titleByType: Map<string, Array<{ id: string; title: string }>>
} {
  const files = new Map<string, string>()
  const titleByType = new Map<string, Array<{ id: string; title: string }>>()
  const usedSlugs = new Map<string, Set<string>>() // type → slugs

  for (const e of entries) {
    if (!PER_ENTRY_TYPES.has(e.type)) continue
    const title = deriveTitle(e)
    const seen = usedSlugs.get(e.type) ?? new Set<string>()
    let slug = slugify(title)
    if (seen.has(slug)) slug = `${slug}-${rowId(e.id)}`.slice(0, 80)
    seen.add(slug)
    usedSlugs.set(e.type, seen)

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
    bucket.push({ id: e.id, title })
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
  // aggregated/chunked file. Index maps are built from the FULL entry
  // set so every cross-ref resolves (Defect B).
  const files = new Map<string, string>()
  const { idTypeIndex, idTitleIndex } = buildIndexMaps(allEntries)
  const opts = vaultOpts(idTypeIndex, idTitleIndex)

  const byType = new Map<string, MemoryEntry[]>()
  for (const e of entries) {
    const bucket = byType.get(e.type) ?? []
    bucket.push(e)
    byType.set(e.type, bucket)
  }

  const { files: noteFiles, titleByType } = buildMemoryEntryNotes(entries, opts)
  for (const [rel, body] of noteFiles) files.set(rel, body)

  for (const [type, items] of byType) {
    if (PER_ENTRY_TYPES.has(type)) {
      // MOC: links every entry note via its stable alias, legible label.
      const links = titleByType.get(type) ?? []
      const moc = [
        `# ${type.toUpperCase()}`,
        '',
        `_${links.length} ${links.length === 1 ? 'entry' : 'entries'} — newest first._`,
        '',
        ...links.map(({ id, title }) => `- [[${id}|${title.replace(/[[\]|]/g, '')}]]`),
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

export function buildTagFiles(
  entries: MemoryEntry[],
  allEntries: MemoryEntry[] = entries
): Map<string, string> {
  // One page per distinct tag pair (`tags/<key>/<value>.md`) + an index
  // per tag key (`tags/<key>.md`). Relation tags are excluded — they're
  // graph edges, not categories (Defect C).
  const files = new Map<string, string>()
  const { idTypeIndex, idTitleIndex } = buildIndexMaps(allEntries)
  const opts = vaultOpts(idTypeIndex, idTitleIndex)
  const byPair = groupByTagPair(entries)

  for (const [key, byValue] of byPair) {
    const keySlug = slugify(key)
    const indexLines = [`# Tag: ${key}`, '']
    const sortedValues = [...byValue.entries()].sort((a, b) => a[0].localeCompare(b[0]))

    for (const [value, items] of sortedValues) {
      const valueSlug = slugify(value)
      const chunks = chunkEntries(items)
      if (chunks.length === 1) {
        const body = [`# ${key}: ${value}`, '', formatMemoryMd(items, opts), ''].join('\n')
        files.set(`tags/${keySlug}/${valueSlug}.md`, body)
        indexLines.push(`- [${value}](${keySlug}/${valueSlug}.md) — ${items.length} entries`)
      } else {
        for (let i = 0; i < chunks.length; i++) {
          const body = [
            `# ${key}: ${value} — chunk ${i + 1}/${chunks.length}`,
            '',
            formatMemoryMd(chunks[i], opts),
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
