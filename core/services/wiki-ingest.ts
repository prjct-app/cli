/**
 * Wiki Ingest — pull user-authored markdown from the Obsidian vault
 * (`.prjct/wiki/captured/*.md`) into project memory.
 *
 * The user opens `.prjct/wiki/` as an Obsidian vault. The `_generated/`
 * subdir is read-only (we rewrite it). The `captured/` dropzone is
 * user-writable: drop a note with frontmatter, run `prjct context wiki
 * sync`, and each note becomes a `projectMemory.remember()` entry.
 *
 * Frontmatter example:
 *
 *   ---
 *   type: learning
 *   tags:
 *     domain: auth
 *     priority: high
 *   ---
 *
 *   Body becomes the memory content.
 *
 * Processed notes are moved to `captured/_ingested/<yyyymmdd-hhmmss>/`
 * so the inbox stays clean. Failures leave the note in place with the
 * error returned in the result so the user can fix and retry.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { MEMORY_TYPES, type MemoryType, projectMemory } from '../memory/project-memory'
import { scanForSecrets } from '../memory/secret-scanner'

const WIKI_ROOT_DIRNAME = '.prjct/wiki'
const CAPTURED_SUBDIR = 'captured'
const INGESTED_SUBDIR = '_ingested'
const README_FILENAME = 'README.md'

/**
 * Frontmatter we understand. Anything else is preserved into the body or
 * ignored — we don't want a strict schema blocking user capture.
 */
interface ParsedNote {
  type: MemoryType
  tags: Record<string, string>
  content: string
}

export interface WikiIngestResult {
  ingested: number
  skipped: { file: string; reason: string }[]
  errors: { file: string; error: string }[]
}

export async function ingestCapturedNotes(
  projectPath: string,
  opts: { force?: boolean } = {}
): Promise<WikiIngestResult> {
  const capturedRoot = path.join(projectPath, WIKI_ROOT_DIRNAME, CAPTURED_SUBDIR)
  const result: WikiIngestResult = { ingested: 0, skipped: [], errors: [] }

  const files = await listNoteFiles(capturedRoot)
  if (files.length === 0) return result

  const archiveRoot = path.join(capturedRoot, INGESTED_SUBDIR, timestampSlug())

  for (const absPath of files) {
    const relName = path.basename(absPath)
    try {
      const raw = await fs.readFile(absPath, 'utf-8')
      const parsed = parseNote(raw)
      if (!parsed.ok) {
        result.skipped.push({ file: relName, reason: parsed.error })
        continue
      }

      const secretHits = scanForSecrets(parsed.note.content)
      if (secretHits.length > 0 && !opts.force) {
        result.skipped.push({
          file: relName,
          reason: `secret-like content (${secretHits.join(', ')}). Remove or re-run with --force.`,
        })
        continue
      }

      await projectMemory.remember(projectPath, {
        type: parsed.note.type,
        content: parsed.note.content,
        tags: parsed.note.tags,
      })

      await moveToArchive(absPath, archiveRoot, relName)
      result.ingested++
    } catch (error) {
      result.errors.push({
        file: relName,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
}

/**
 * Write the captured/README.md if it's absent. Called from wiki-generator
 * on every regen so users who open the vault discover the workflow.
 */
export async function ensureCapturedReadme(projectPath: string): Promise<void> {
  const capturedRoot = path.join(projectPath, WIKI_ROOT_DIRNAME, CAPTURED_SUBDIR)
  await fs.mkdir(capturedRoot, { recursive: true })
  const readmePath = path.join(capturedRoot, README_FILENAME)
  const exists = await fs.stat(readmePath).then(
    () => true,
    () => false
  )
  if (exists) return
  await fs.writeFile(readmePath, CAPTURED_README_BODY, 'utf-8')
}

const CAPTURED_README_BODY = `# Captured notes (Obsidian dropzone)

Drop a markdown note here, run \`prjct context wiki sync\`, and each note
becomes a project-memory entry. Processed notes move to \`_ingested/\` so
this folder stays your inbox.

## Format

\`\`\`markdown
---
type: learning
tags:
  domain: auth
  priority: high
---

Body becomes the memory content. Multi-line is fine — everything below
the frontmatter is preserved verbatim.
\`\`\`

## Valid types

${MEMORY_TYPES.map((t) => `- \`${t}\``).join('\n')}

## Notes

- \`type\` is required. If missing, the note is skipped.
- \`tags\` is optional — a flat \`key: value\` map.
- Secret-like content (API keys, JWTs) is refused unless you pass
  \`--force\` to \`prjct context wiki sync\`.
- Files already in \`_ingested/\` are ignored.
`

// =============================================================================
// Helpers
// =============================================================================

async function listNoteFiles(capturedRoot: string): Promise<string[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(capturedRoot)
  } catch {
    return []
  }
  const files: string[] = []
  for (const name of entries) {
    if (name.startsWith('.')) continue
    if (name === INGESTED_SUBDIR) continue
    if (name === README_FILENAME) continue
    if (!name.toLowerCase().endsWith('.md')) continue
    files.push(path.join(capturedRoot, name))
  }
  return files
}

async function moveToArchive(absPath: string, archiveRoot: string, relName: string): Promise<void> {
  await fs.mkdir(archiveRoot, { recursive: true })
  const dest = path.join(archiveRoot, relName)
  await fs.rename(absPath, dest)
}

function timestampSlug(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
}

type ParseResult = { ok: true; note: ParsedNote } | { ok: false; error: string }

/**
 * Minimal frontmatter parser. Accepts the YAML subset we actually need
 * (flat `k: v` lines + a `tags:` nested map). We deliberately avoid
 * pulling in a full YAML library — the format is stable and small, and
 * a bad frontmatter should fail loud, not coerce.
 */
function parseNote(raw: string): ParseResult {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/)
  if (!match) return { ok: false, error: 'no frontmatter (expected leading `---` block)' }

  const [, frontmatter, body] = match
  const { type, tags, error } = parseFrontmatter(frontmatter)
  if (error) return { ok: false, error }
  if (!type) return { ok: false, error: 'missing `type` in frontmatter' }
  if (!(MEMORY_TYPES as readonly string[]).includes(type)) {
    return {
      ok: false,
      error: `invalid type '${type}'. Valid: ${MEMORY_TYPES.join(' | ')}`,
    }
  }

  const content = body.trim()
  if (!content) return { ok: false, error: 'body is empty' }

  return {
    ok: true,
    note: { type: type as MemoryType, tags, content },
  }
}

function parseFrontmatter(text: string): {
  type?: string
  tags: Record<string, string>
  error?: string
} {
  const lines = text.split(/\r?\n/)
  let type: string | undefined
  const tags: Record<string, string> = {}
  let inTags = false

  for (const line of lines) {
    if (line.trim() === '') {
      continue
    }
    if (inTags && /^\s+/.test(line)) {
      const trimmed = line.trim()
      const idx = trimmed.indexOf(':')
      if (idx > 0) {
        const k = trimmed.slice(0, idx).trim()
        const v = stripQuotes(trimmed.slice(idx + 1).trim())
        if (k) tags[k] = v
      }
      continue
    }
    inTags = false
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = stripQuotes(line.slice(idx + 1).trim())
    if (key === 'type') {
      type = value.toLowerCase()
    } else if (key === 'tags') {
      if (value) {
        // Inline tags syntax: `tags: domain=auth, priority=high`.
        for (const pair of value.split(',')) {
          const p = pair.trim()
          const eq = p.indexOf('=')
          const colon = p.indexOf(':')
          const sep = eq > 0 ? eq : colon
          if (sep <= 0) continue
          tags[p.slice(0, sep).trim()] = p.slice(sep + 1).trim()
        }
      } else {
        inTags = true
      }
    }
  }

  return { type, tags }
}

function stripQuotes(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}
