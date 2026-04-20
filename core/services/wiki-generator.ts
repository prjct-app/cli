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
import shippedStorage from '../storage/shipped-storage'
import type { ShippedFeature } from '../types/storage'

const WIKI_DIRNAME = '.prjct/wiki'

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
  const wikiRoot = path.join(projectPath, WIKI_DIRNAME)
  await fs.rm(wikiRoot, { recursive: true, force: true })
  await fs.mkdir(wikiRoot, { recursive: true })

  const ships = await shippedStorage.getAll(projectId)
  const entries = projectMemory.recall(projectId, { limit: 500 })
  const declaredEntries = entries.filter((e) => e.type !== 'shipped')
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
    await writeFile(wikiRoot, `ships/${slug}.md`, formatShipBody(ship))
    filesWritten++
  }

  // Memory by type
  for (const [type, items] of byType) {
    const body = [`# ${type.toUpperCase()}`, '', formatMemoryMd(items), ''].join('\n')
    await writeFile(wikiRoot, `memory/${type}.md`, body)
    filesWritten++
  }

  // Memory by tag key
  for (const [key, items] of byTag) {
    const body = [`# Tag: ${key}`, '', formatMemoryMd(items), ''].join('\n')
    await writeFile(wikiRoot, `tags/${slugify(key)}.md`, body)
    filesWritten++
  }

  // Index
  const indexLines: string[] = []
  indexLines.push('# Project Wiki')
  indexLines.push('')
  indexLines.push('Agent-crawlable snapshot of project memory. Regenerated on `prjct ship`.')
  indexLines.push('Read directly with Read/Glob — no CLI round-trip needed.')
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

  if (ships.length === 0 && declaredEntries.length === 0) {
    indexLines.push('> No ships or memory entries yet. Run `prjct remember` or `prjct ship`.')
  }

  await writeFile(wikiRoot, 'index.md', `${indexLines.join('\n')}\n`)
  filesWritten++

  return { wikiRoot, filesWritten }
}
