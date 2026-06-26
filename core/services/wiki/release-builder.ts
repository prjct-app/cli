/**
 * Release file builder.
 *
 * `CHANGELOG.md` is the source of truth and ships in the repo. The vault used
 * to mirror it as one file PER version (hundreds of near-empty notes nobody
 * reads — pure sprawl). Instead we emit a SINGLE semantic release-history rollup: a
 * newest-first table with a one-line summary per version, pointing at
 * `CHANGELOG.md` for the full notes.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { RELEASE_HISTORY_FILE, type ReleaseEntry, truncate, VAULT_HOME_FILE } from './_shared'

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

/** First non-empty, de-bulleted line of a changelog body, table-cell safe. */
function firstMeaningfulLine(body: string): string {
  for (const raw of body.split('\n')) {
    const t = raw.replace(/^[-*#>\s]+/, '').trim()
    if (t) return truncate(t.replace(/\|/g, '\\|'), 80)
  }
  return '—'
}

function buildReleasesIndex(entries: ReleaseEntry[]): string {
  const lines: string[] = ['# Releases', '']
  lines.push(
    `${entries.length} version${entries.length === 1 ? '' : 's'} parsed from \`CHANGELOG.md\`. Newest first — full notes live in \`CHANGELOG.md\`.`
  )
  lines.push('')
  lines.push(`See also: [project context](../${VAULT_HOME_FILE})`)
  lines.push('')
  lines.push('| Date | Version | Summary |')
  lines.push('|---|---|---|')
  for (const entry of entries) {
    lines.push(`| ${entry.date} | ${entry.version} | ${firstMeaningfulLine(entry.body)} |`)
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

  // One consolidated rollup — NOT one file per version (that was the sprawl).
  out.set(RELEASE_HISTORY_FILE, buildReleasesIndex(entries))
  return out
}
