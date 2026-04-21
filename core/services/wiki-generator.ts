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
import { formatMemoryMd, type MemoryEntry, projectMemory } from '../memory/project-memory'
import { analysisStorage } from '../storage/analysis-storage'
import shippedStorage from '../storage/shipped-storage'
import type { ShippedFeature } from '../types/storage'
import { ensureCapturedReadme } from './wiki-ingest'

// Generated output goes into a dedicated subdir so user notes placed in
// `.prjct/wiki/` (e.g. `my-notes.md`) survive wiki rebuilds. Only this
// subdir gets touched.
const WIKI_ROOT_DIRNAME = '.prjct/wiki'
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
  patterns: { name: string; description: string; locations?: string[] }[],
  antiPatterns: { issue: string; suggestion: string; files?: string[] }[]
): string | null {
  if (patterns.length === 0 && antiPatterns.length === 0) return null
  const lines: string[] = ['# Patterns (inferred)', '']
  if (patterns.length > 0) {
    lines.push('## Patterns')
    for (const p of patterns) {
      const loc =
        p.locations && p.locations.length > 0 ? ` — ${p.locations.slice(0, 3).join(', ')}` : ''
      lines.push(`- **${p.name}**: ${p.description}${loc}`)
    }
    lines.push('')
  }
  if (antiPatterns.length > 0) {
    lines.push('## Anti-patterns')
    for (const a of antiPatterns) {
      const file = a.files && a.files.length > 0 ? ` (${a.files[0]})` : ''
      lines.push(`- **${a.issue}**${file} — ${a.suggestion}`)
    }
    lines.push('')
  }
  lines.push('> Source: `prjct sync` analysis. Provenance: INFR.')
  return `${lines.join('\n')}\n`
}

function buildIndexFile(args: {
  ships: ShippedFeature[]
  memoryTypeCounts: Map<string, number>
  tagKeyCounts: Map<string, number>
  patternsCount: number
  antiPatternsCount: number
}): string {
  const { ships, memoryTypeCounts, tagKeyCounts, patternsCount, antiPatternsCount } = args
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

  if (patternsCount > 0 || antiPatternsCount > 0) {
    lines.push('## Inferred')
    lines.push(
      `- [patterns](patterns.md) — ${patternsCount} patterns, ${antiPatternsCount} anti-patterns`
    )
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
  const wikiRoot = path.join(projectPath, WIKI_ROOT_DIRNAME)
  const generatedRoot = path.join(wikiRoot, GENERATED_SUBDIR)
  await fs.mkdir(generatedRoot, { recursive: true })

  // --- Gather sources ---
  const [ships, entries, analysis] = await Promise.all([
    shippedStorage.getAll(projectId),
    Promise.resolve(projectMemory.recall(projectId, { limit: 5000 })),
    analysisStorage.getActive(projectId).catch(() => null),
  ])
  const declared = entries.filter((e) => e.type !== 'shipped')

  // --- Build all file bodies in memory ---
  const files = new Map<string, string>()

  for (const ship of ships) {
    files.set(`ships/${slugify(ship.name)}.md`, formatShipBody(ship))
  }
  for (const [rel, body] of buildMemoryFiles(declared)) files.set(rel, body)
  for (const [rel, body] of buildTagFiles(declared)) files.set(rel, body)

  const patterns = analysis?.patterns ?? []
  const antiPatterns = analysis?.antiPatterns ?? []
  const patternsBody = buildPatternsFile(patterns, antiPatterns)
  if (patternsBody) files.set('patterns.md', patternsBody)

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
