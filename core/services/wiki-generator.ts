/**
 * Wiki Generator — emit an agent-crawlable markdown map of the project's
 * memory + shipped history to `.prjct/wiki/`.
 *
 * Why: prjct already holds the answers (memories, patterns, ships). The
 * fastest way for a subagent to read them is through its native Read/Glob
 * tools, not a CLI round-trip into SQLite. A static markdown tree eats
 * zero tokens until the agent opens the specific file it cares about.
 *
 * Regenerated on `prjct ship` (which is when new "truth" has landed).
 * Cheap enough to regenerate — no incremental logic needed.
 *
 * Output layout (under the repo root):
 *   .prjct/wiki/
 *     index.md                 — entry point, links to everything
 *     ships/<slug>.md          — one file per shipped feature
 *     memory/<type>.md         — one file per memory type w/ entries
 *     tags/<key>.md            — one file per distinct tag key
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { formatMemoryMd, type MemoryEntry, projectMemory } from '../memory/project-memory'
import { analysisStorage } from '../storage/analysis-storage'
import shippedStorage from '../storage/shipped-storage'
import type { ShippedFeature } from '../types/storage'

// Generated output goes into a dedicated subdir so user notes placed in
// `.prjct/wiki/` (e.g. `my-notes.md`) survive wiki rebuilds. Only this
// subdir gets wiped.
const WIKI_ROOT_DIRNAME = '.prjct/wiki'
const GENERATED_SUBDIR = '_generated'

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'unnamed'
  )
}

async function writeFile(wikiRoot: string, relPath: string, body: string): Promise<void> {
  const fullPath = path.join(wikiRoot, relPath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, body, 'utf-8')
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

function groupByTagKey(entries: MemoryEntry[]): Map<string, MemoryEntry[]> {
  const byKey = new Map<string, MemoryEntry[]>()
  for (const entry of entries) {
    for (const key of Object.keys(entry.tags)) {
      const bucket = byKey.get(key) ?? []
      bucket.push(entry)
      byKey.set(key, bucket)
    }
  }
  return byKey
}

/**
 * Rebuild the wiki from scratch. Blows the directory away first so stale
 * ships/memories don't hang around.
 */
export async function generateWiki(
  projectPath: string,
  projectId: string
): Promise<{
  wikiRoot: string
  filesWritten: number
}> {
  const wikiRoot = path.join(projectPath, WIKI_ROOT_DIRNAME)
  const generatedRoot = path.join(wikiRoot, GENERATED_SUBDIR)
  // Only the _generated/ subdir gets wiped — the user's own notes at
  // `.prjct/wiki/*.md` are preserved across rebuilds.
  await fs.rm(generatedRoot, { recursive: true, force: true })
  await fs.mkdir(generatedRoot, { recursive: true })

  const ships = await shippedStorage.getAll(projectId)
  const entries = projectMemory.recall(projectId, { limit: 500 })
  const declaredEntries = entries.filter((e) => e.type !== 'shipped')
  const analysis = await analysisStorage.getActive(projectId).catch(() => null)
  const byType = new Map<string, MemoryEntry[]>()
  for (const entry of declaredEntries) {
    const bucket = byType.get(entry.type) ?? []
    bucket.push(entry)
    byType.set(entry.type, bucket)
  }
  const byTag = groupByTagKey(declaredEntries)

  let filesWritten = 0

  // Ships
  for (const ship of ships) {
    const slug = slugify(ship.name)
    await writeFile(generatedRoot, `ships/${slug}.md`, formatShipBody(ship))
    filesWritten++
  }

  // Memory by type
  for (const [type, items] of byType) {
    const body = [`# ${type.toUpperCase()}`, '', formatMemoryMd(items), ''].join('\n')
    await writeFile(generatedRoot, `memory/${type}.md`, body)
    filesWritten++
  }

  // Memory by tag key
  for (const [key, items] of byTag) {
    const body = [`# Tag: ${key}`, '', formatMemoryMd(items), ''].join('\n')
    await writeFile(generatedRoot, `tags/${slugify(key)}.md`, body)
    filesWritten++
  }

  // Patterns + anti-patterns from the most recent project analysis.
  // These are distinct from memory entries: memory is user/agent-declared;
  // these are inferred by pattern-extractor during `prjct sync`. Surfaced
  // so an agent reading the wiki gets the full picture.
  const patterns = analysis?.patterns ?? []
  const antiPatterns = analysis?.antiPatterns ?? []
  if (patterns.length > 0 || antiPatterns.length > 0) {
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
    await writeFile(generatedRoot, 'patterns.md', `${lines.join('\n')}\n`)
    filesWritten++
  }

  // Index
  const indexLines: string[] = []
  indexLines.push('# Project Wiki (generated)')
  indexLines.push('')
  indexLines.push('Agent-crawlable snapshot of project memory. Regenerated on `prjct ship`.')
  indexLines.push('Read directly with Read/Glob — no CLI round-trip needed.')
  indexLines.push('')
  indexLines.push('> Auto-generated. Your own notes under `.prjct/wiki/` are preserved.')
  indexLines.push('')

  if (ships.length > 0) {
    indexLines.push('## Ships')
    for (const ship of ships) {
      const slug = slugify(ship.name)
      indexLines.push(`- [${ship.name}](ships/${slug}.md) — ${ship.shippedAt}`)
    }
    indexLines.push('')
  }

  if (byType.size > 0) {
    indexLines.push('## Memory by type')
    for (const [type, items] of byType) {
      indexLines.push(`- [${type}](memory/${type}.md) — ${items.length} entries`)
    }
    indexLines.push('')
  }

  if (byTag.size > 0) {
    indexLines.push('## Memory by tag')
    for (const [key, items] of byTag) {
      indexLines.push(`- [${key}](tags/${slugify(key)}.md) — ${items.length} entries`)
    }
    indexLines.push('')
  }

  if (patterns.length > 0 || antiPatterns.length > 0) {
    indexLines.push('## Inferred')
    indexLines.push(
      `- [patterns](patterns.md) — ${patterns.length} patterns, ${antiPatterns.length} anti-patterns`
    )
    indexLines.push('')
  }

  if (
    ships.length === 0 &&
    declaredEntries.length === 0 &&
    patterns.length === 0 &&
    antiPatterns.length === 0
  ) {
    indexLines.push(
      '> No ships, memory, or patterns yet. Run `prjct remember`, `prjct ship`, or `prjct sync`.'
    )
  }

  await writeFile(generatedRoot, 'index.md', `${indexLines.join('\n')}\n`)
  filesWritten++

  // Top-level README pointer. Only written if the user hasn't placed their
  // own README.md at `.prjct/wiki/` — we never clobber user files.
  const topReadmePath = path.join(wikiRoot, 'README.md')
  const topReadmeExists = await fs.stat(topReadmePath).then(
    () => true,
    () => false
  )
  if (!topReadmeExists) {
    await writeFile(
      wikiRoot,
      'README.md',
      `# Project Wiki\n\nAuto-generated content lives in \`${GENERATED_SUBDIR}/\`. Start at [${GENERATED_SUBDIR}/index.md](${GENERATED_SUBDIR}/index.md).\n\nAny markdown you put here (alongside \`${GENERATED_SUBDIR}/\`) survives rebuilds.\n`
    )
    filesWritten++
  }

  return { wikiRoot, filesWritten }
}
