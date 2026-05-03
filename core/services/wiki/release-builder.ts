/**
 * Release file builder.
 *
 * Most projects have way more history in their CHANGELOG than in the
 * young prjct SQLite tables. Parse `CHANGELOG.md` and emit one file
 * per `## [version] - date` block so every release shows up in the
 * vault as a discrete, addressable note.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ReleaseEntry } from './_shared'

export function parseChangelog(raw: string): ReleaseEntry[] {
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

export function releaseSlug(version: string): string {
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

export async function buildReleasesFiles(projectPath: string): Promise<Map<string, string>> {
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
