/**
 * Memory + tag + ship file builders.
 *
 * Pure functions: take memory entries / shipped features in, return a
 * `{ relPath: body }` map ready for the orchestrator to diff against
 * the on-disk manifest. No I/O.
 */

import { formatMemoryMd, type MemoryEntry } from '../../memory/project-memory'
import type { ShippedFeature } from '../../types/storage'
import { chunkEntries, slugify } from './_shared'

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

export function buildMemoryFiles(entries: MemoryEntry[]): Map<string, string> {
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
      const body = [`# ${type.toUpperCase()}`, '', formatMemoryMd(items), ''].join('\n')
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

export function buildTagFiles(entries: MemoryEntry[]): Map<string, string> {
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
