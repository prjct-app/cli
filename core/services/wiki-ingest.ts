/**
 * Wiki Ingest — pull user-dropped files from the Obsidian vault
 * (`.prjct/wiki/captured/`) into project memory, the INPUT half of the
 * bidirectional vault.
 *
 * The user opens `.prjct/wiki/` as an Obsidian vault. The `_generated/`
 * subdir is read-only (we rewrite it). The `captured/` dropzone is
 * user-writable. Drop a file, run `prjct context wiki sync` (or let the Stop
 * hook do it), and it becomes memory — which the embeddings backfill then
 * vectorizes into the DB. Two shapes:
 *
 *   1. Structured memory — a markdown file WITH frontmatter → one atomic,
 *      typed entry. A bad/missing `type` fails loud (file stays for a retry).
 *
 *        ---
 *        type: learning
 *        tags: { domain: auth }
 *        ---
 *        Body becomes the memory content.
 *
 *   2. Raw document — any other supported text file (`.txt`, `.json`, `.csv`,
 *      a frontmatter-less `.md`, …) → a `source` entry, chunked when long so
 *      recall surfaces the relevant passage. Binary formats (pdf/images) are
 *      a future extractor step that feeds text through this same pipeline.
 *
 * Processed files move to `captured/_ingested/<yyyymmdd-hhmmss>/` so the inbox
 * stays clean. Failures leave the file in place with the error in the result.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import configManager from '../infrastructure/config-manager'
import { MEMORY_TYPES, type MemoryType } from '../memory/entries'
import { projectMemory } from '../memory/project-memory'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import type { LocalConfig } from '../types/config'
import type { WorkflowRule } from '../types/storage/extended'
import { scanForPromptInjection } from '../utils/prompt-injection'
import { scanForSecrets } from '../utils/secret-scanner'
import { EXTRACTABLE_EXTENSIONS, extractHint, extractText } from './ingest-extractors'
import { resolveVaultRoot } from './wiki-migration'

const CAPTURED_SUBDIR = 'captured'
const WORKFLOWS_SUBDIR = 'workflows'
const INGESTED_SUBDIR = '_ingested'
const README_FILENAME = 'README.md'

/**
 * Text formats we ingest directly (no dependency, no extraction step). Binary
 * formats (pdf, images, docx) plug in later as `extractors` that turn bytes
 * into text fed through this same pipeline — keeping that out of here is what
 * keeps the ingest dependency-free today.
 */
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.mdx',
  '.txt',
  '.text',
  '.json',
  '.yaml',
  '.yml',
  '.csv',
  '.tsv',
  '.log',
  '.rst',
  '.org',
])
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx'])
/** A frontmatter-less drop is a raw document; it lands as this memory type. */
const DEFAULT_DOC_TYPE: MemoryType = 'source'
/** Below this, a document is one memory; above it, it is chunked so recall
 *  surfaces the relevant passage instead of a wall of text. */
const SINGLE_CHUNK_LIMIT = 2200
const CHUNK_TARGET = 1500

async function resolveCapturedRoot(projectPath: string): Promise<string> {
  return path.join(await resolveVaultRoot(projectPath), CAPTURED_SUBDIR)
}

async function resolveWorkflowsRoot(projectPath: string): Promise<string> {
  return path.join(await resolveVaultRoot(projectPath), WORKFLOWS_SUBDIR)
}

/**
 * Frontmatter we understand. Anything else is preserved into the body or
 * ignored — we don't want a strict schema blocking user capture.
 */
interface ParsedNote {
  type: MemoryType
  tags: Record<string, string>
  content: string
}

interface WikiIngestResult {
  ingested: number
  skipped: { file: string; reason: string }[]
  errors: { file: string; error: string }[]
}

export async function ingestCapturedNotes(
  projectPath: string,
  opts: { force?: boolean } = {}
): Promise<WikiIngestResult> {
  const capturedRoot = await resolveCapturedRoot(projectPath)
  const result: WikiIngestResult = { ingested: 0, skipped: [], errors: [] }

  const files = await listNoteFiles(capturedRoot)
  if (files.length === 0) return result

  const archiveRoot = path.join(capturedRoot, INGESTED_SUBDIR, timestampSlug())

  for (const absPath of files) {
    const relName = path.basename(absPath)
    try {
      const ext = path.extname(relName).toLowerCase()
      let built: BuildResult
      if (TEXT_EXTENSIONS.has(ext)) {
        built = buildEntries(relName, await fs.readFile(absPath, 'utf-8'))
      } else {
        // Binary / rich document → external extractor (textutil / pdftotext /
        // tesseract) IF the user has one. Absent → skip with an install hint;
        // the file stays in the inbox so a re-sync after install picks it up.
        const extracted = await extractText(absPath)
        built = extracted
          ? {
              ok: true,
              entries: buildDocEntries(relName, extracted.text, { extracted: extracted.tool }),
            }
          : { ok: false, error: `no text extracted from ${ext} — ${extractHint(ext)}` }
      }
      if (!built.ok) {
        result.skipped.push({ file: relName, reason: built.error })
        continue
      }

      // Scan the whole document once (cheaper than per-chunk, and a secret
      // split across a chunk boundary still gets caught on the joined text).
      const fullText = built.entries.map((e) => e.content).join('\n')
      const secretHits = scanForSecrets(fullText)
      if (secretHits.length > 0 && !opts.force) {
        result.skipped.push({
          file: relName,
          reason: `secret-like content (${secretHits.join(', ')}). Remove or re-run with --force.`,
        })
        continue
      }

      const injectionHits = scanForPromptInjection(fullText)
      if (injectionHits.length > 0 && !opts.force) {
        result.skipped.push({
          file: relName,
          reason: `prompt-injection-like content (${injectionHits.join(', ')}). Notes are inlined into LLM context — refuse by default. Remove or re-run with --force.`,
        })
        continue
      }

      for (const entry of built.entries) {
        await projectMemory.remember(projectPath, {
          type: entry.type,
          content: entry.content,
          tags: entry.tags,
        })
      }

      await moveToArchive(absPath, archiveRoot, relName)
      result.ingested += built.entries.length
    } catch (error) {
      result.errors.push({
        file: relName,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
}

type BuildResult = { ok: true; entries: ParsedNote[] } | { ok: false; error: string }

/**
 * Turn one captured file into the memory entries it should become:
 *   - a markdown file WITH frontmatter → one atomic, typed entry (the user is
 *     authoring a structured memory; a bad/absent `type` fails loud);
 *   - anything else (a frontmatter-less drop, a `.txt`/`.json`/`.csv`/… file)
 *     → a raw `source` document, chunked so recall surfaces the right passage.
 *
 * Raw documents keep their original language (unlike agent-authored memory,
 * which is English by convention) — translating user-dropped content would
 * need a model; the local embedder still indexes it lexically.
 */
function buildEntries(relName: string, raw: string): BuildResult {
  const ext = path.extname(relName).toLowerCase()
  const isMarkdown = MARKDOWN_EXTENSIONS.has(ext)
  const hasFrontmatter = /^---\s*\r?\n/.test(raw)

  if (isMarkdown && hasFrontmatter) {
    const parsed = parseNote(raw)
    return parsed.ok ? { ok: true, entries: [parsed.note] } : { ok: false, error: parsed.error }
  }

  const text = raw.trim()
  if (!text) return { ok: false, error: 'empty file' }
  return { ok: true, entries: buildDocEntries(relName, text) }
}

/**
 * A raw document (frontmatter-less text, or text extracted from a binary) →
 * `source` memory entries, chunked when long. `extraTags` carries provenance
 * like `extracted: pdftotext`. Callers guarantee non-empty text.
 */
function buildDocEntries(
  relName: string,
  text: string,
  extraTags: Record<string, string> = {}
): ParsedNote[] {
  const baseTags: Record<string, string> = { file: relName, origin: 'ingest', ...extraTags }
  const chunks = chunkText(text.trim())
  if (chunks.length === 1) {
    return [{ type: DEFAULT_DOC_TYPE, tags: baseTags, content: chunks[0]! }]
  }
  const docSlug = slugifyName(relName)
  return chunks.map((content, i) => ({
    type: DEFAULT_DOC_TYPE,
    tags: { ...baseTags, doc: docSlug, part: `${i + 1}/${chunks.length}` },
    content,
  }))
}

/**
 * Split a long document into recall-sized chunks on blank-line (paragraph)
 * boundaries, greedily packing toward CHUNK_TARGET. A single paragraph larger
 * than the limit is hard-split so one runaway block can't defeat chunking.
 */
function chunkText(text: string): string[] {
  if (text.length <= SINGLE_CHUNK_LIMIT) return [text]
  const paras = text.split(/\r?\n\s*\r?\n/)
  const chunks: string[] = []
  let cur = ''
  const flush = () => {
    if (cur.trim()) chunks.push(cur.trim())
    cur = ''
  }
  for (const raw of paras) {
    const para = raw.trim()
    if (!para) continue
    if (para.length > SINGLE_CHUNK_LIMIT) {
      flush()
      for (let i = 0; i < para.length; i += CHUNK_TARGET)
        chunks.push(para.slice(i, i + CHUNK_TARGET))
      continue
    }
    if (cur && cur.length + para.length + 2 > CHUNK_TARGET) flush()
    cur = cur ? `${cur}\n\n${para}` : para
  }
  flush()
  return chunks.length > 0 ? chunks : [text]
}

/** Filename → a stable slug used to group a document's chunks (`doc:` tag). */
function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'doc'
  )
}

/**
 * Write the captured/README.md if it's absent. Called from wiki-generator
 * on every regen so users who open the vault discover the workflow.
 */
export async function ensureCapturedReadme(projectPath: string): Promise<void> {
  const capturedRoot = await resolveCapturedRoot(projectPath)
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

Drop a file here, run \`prjct context wiki sync\`, and it becomes project
memory — searchable and vectorized into the DB. Processed files move to
\`_ingested/\` so this folder stays your inbox.

## Two ways to drop

**1. Structured memory** — a markdown file WITH frontmatter becomes one typed
entry:

\`\`\`markdown
---
type: learning
tags:
  domain: auth
  priority: high
---

Body becomes the memory content. Multi-line is fine.
\`\`\`

**2. Raw document** — any text file with NO frontmatter (\`.txt\`, \`.md\`,
\`.json\`, \`.yaml\`, \`.csv\`, \`.log\`, …) is ingested as a \`source\`. Long
documents are auto-chunked so recall surfaces the relevant passage.

## Valid types (for structured notes)

${MEMORY_TYPES.map((t) => `- \`${t}\``).join('\n')}

## Notes

- Structured notes need a valid \`type\`; a bad/missing type is skipped (the
  file stays here so you can fix it). Files with no frontmatter are NOT
  skipped — they ingest as raw documents.
- \`tags\` is optional — a flat \`key: value\` map.
- Supported text formats: \`.md .markdown .mdx .txt .text .json .yaml .yml
  .csv .tsv .log .rst .org\`.
- Binary / rich docs are extracted via tools you already have (zero bundled
  dependency): \`.docx/.doc/.rtf/.html/.pages\` → \`textutil\` (macOS);
  \`.pdf\` → \`pdftotext\` (\`brew install poppler\`); images → \`tesseract\`
  (\`brew install tesseract\`). Without the tool, the file is left here with a
  hint so a re-sync after install picks it up.
- Raw documents keep their original language; agent-authored memory is English.
- Secret-like content (API keys, JWTs) is refused unless you pass
  \`--force\` to \`prjct context wiki sync\`.
- Files already in \`_ingested/\` are ignored.
`

// Helpers

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
    const fileExt = path.extname(name).toLowerCase()
    if (!TEXT_EXTENSIONS.has(fileExt) && !EXTRACTABLE_EXTENSIONS.has(fileExt)) continue
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

  // Types are freeform — allow any lowercase identifier. Base types are
  // listed for discovery, custom ones persist without ceremony.
  if (!/^[a-z][a-z0-9-]*$/.test(type)) {
    return {
      ok: false,
      error: `invalid type '${type}'. Lowercase letters + dashes only. Base types: ${MEMORY_TYPES.join(', ')}`,
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

// Workflow ingest (M1b INPUT half) — bidirectional editing of workflows
// from <vault>/workflows/<command>.md.
//
// Pattern mirrors captured/: user drops a .md, Stop hook ingests, file is
// archived to workflows/_ingested/<timestamp>/. Difference: workflow
// ingest REPLACES the SQLite rules for that command rather than appending.

interface ParsedWorkflow {
  command: string
  rules: Array<{
    type: WorkflowRule['type']
    action: string
    description: string | null
    sortOrder: number
    position: string
    whenExpr: string | null
  }>
}

interface WorkflowIngestResult {
  ingested: { command: string; rulesReplaced: number }[]
  skipped: { file: string; reason: string }[]
  errors: { file: string; error: string }[]
}

/**
 * Ingest workflow overrides from <vault>/workflows/*.md. For every valid
 * file found, REPLACE all SQLite rules for that command with the parsed
 * rules (delete + insert). Files are archived to workflows/_ingested/
 * after successful ingest. The wiki regen will recreate the read-only
 * snapshot under _generated/workflows/ on the next run, so the user
 * sees their edits reflected immediately.
 */
export async function ingestWorkflowEdits(
  projectPath: string,
  preloadedConfig?: LocalConfig | null
): Promise<WorkflowIngestResult> {
  const result: WorkflowIngestResult = { ingested: [], skipped: [], errors: [] }
  const config =
    preloadedConfig !== undefined
      ? preloadedConfig
      : await configManager.readConfig(projectPath).catch(() => null)
  if (!config?.projectId) return result
  const projectId = config.projectId

  const workflowsRoot = await resolveWorkflowsRoot(projectPath)
  const files = await listWorkflowFiles(workflowsRoot)
  if (files.length === 0) return result

  const archiveRoot = path.join(workflowsRoot, INGESTED_SUBDIR, timestampSlug())

  for (const absPath of files) {
    const relName = path.basename(absPath)
    try {
      const raw = await fs.readFile(absPath, 'utf-8')
      const parsed = parseWorkflowMarkdown(raw)
      if (!parsed.ok) {
        result.skipped.push({ file: relName, reason: parsed.error })
        continue
      }
      const wf = parsed.workflow

      // Replace existing rules for this command. Done as delete + insert to
      // keep the schema simple — workflowRuleStorage doesn't expose a
      // per-command nuke today, so we iterate.
      const existing = workflowRuleStorage.getRulesForCommand(projectId, wf.command)
      for (const r of existing) workflowRuleStorage.removeRule(projectId, r.id)

      for (const r of wf.rules) {
        workflowRuleStorage.addRule(projectId, {
          type: r.type,
          command: wf.command,
          position: r.position,
          action: r.action,
          description: r.description,
          enabled: true,
          timeoutMs: 60_000,
          sortOrder: r.sortOrder,
          createdAt: new Date().toISOString(),
          // SECURITY: rules ingested from the vault originate from
          // repo-reachable markdown — a malicious repo could commit a
          // workflow with a shell hook. Mark `imported` so the
          // workflow-engine approval gate refuses to auto-exec them.
          trustSource: 'imported',
        })
      }

      await moveToArchive(absPath, archiveRoot, relName)
      result.ingested.push({ command: wf.command, rulesReplaced: wf.rules.length })
    } catch (error) {
      result.errors.push({
        file: relName,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
}

export async function ensureWorkflowsReadme(projectPath: string): Promise<void> {
  const workflowsRoot = await resolveWorkflowsRoot(projectPath)
  await fs.mkdir(workflowsRoot, { recursive: true })
  const readmePath = path.join(workflowsRoot, README_FILENAME)
  const exists = await fs.stat(readmePath).then(
    () => true,
    () => false
  )
  if (exists) return
  await fs.writeFile(readmePath, WORKFLOWS_README_BODY, 'utf-8')
}

const WORKFLOWS_README_BODY = `# Workflows (Obsidian dropzone)

Drop a markdown file here to OVERRIDE a workflow's rules in SQLite. Format:

\`\`\`markdown
---
name: ship
---

## Gates
- \`git branch --show-current | grep -vE "^(main|master)$"\` — Prevent shipping from main branch

## Steps
- \`version:bump\` — Bump version (stack-aware)
- \`changelog:add\` — Append CHANGELOG entry
- \`git:commit\` — Commit ship
- \`git:push\` — Push to origin
\`\`\`

## How it works

1. You drop \`workflows/<name>.md\` here.
2. Stop hook (or \`prjct context wiki sync\`) reads it.
3. ALL existing rules for that workflow are deleted from SQLite.
4. New rules from your file are inserted.
5. Wiki regenerates → \`_generated/workflows/<name>.md\` reflects your edits.
6. Your file moves to \`_ingested/<timestamp>/\` so this folder stays clean.

## Schema

- Frontmatter \`name:\` is required (the workflow command: ship, task, sync, …)
- Sections: \`## Gates\`, \`## Steps\`, \`## Hooks\`, \`## Instructions\` (any subset)
- Each bullet: \`- \\\`<action>\\\` — <description>\` (description optional)
- Order within a section is preserved as sortOrder

## Notes

- This is destructive: SQLite rules for the named workflow are REPLACED, not merged.
- To restore a built-in workflow, run \`prjct workflow reset <name>\`.
- \`README.md\` and \`index.md\` are ignored.
- Files in \`_ingested/\` are ignored.
`

type WorkflowParseSuccess = { ok: true; workflow: ParsedWorkflow }
type WorkflowParseFailure = { ok: false; error: string }

function parseWorkflowMarkdown(raw: string): WorkflowParseSuccess | WorkflowParseFailure {
  // Frontmatter: name is required.
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!fmMatch) return { ok: false, error: 'missing frontmatter (---name: foo---)' }
  const fmBody = fmMatch[1]
  const body = fmMatch[2]
  const nameMatch = fmBody.match(/^\s*name\s*:\s*(\S+)/m)
  if (!nameMatch) return { ok: false, error: "frontmatter missing 'name' field" }
  const command = stripQuotes(nameMatch[1].trim())

  const rules: ParsedWorkflow['rules'] = []
  // Section parsing: ## Gates / ## Steps / ## Hooks / ## Instructions
  const sectionMap: Record<string, { type: WorkflowRule['type']; position: string }> = {
    gates: { type: 'gate', position: 'before' },
    steps: { type: 'step', position: 'before' },
    hooks: { type: 'hook', position: 'before' },
    instructions: { type: 'instruction', position: 'before' },
  }
  const sectionRegex = /^##\s+(\w+)/gm
  const matches = [...body.matchAll(sectionRegex)]

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const heading = m[1].toLowerCase()
    const meta = sectionMap[heading]
    if (!meta) continue
    const start = m.index! + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length
    const sectionBody = body.slice(start, end)
    let order = 0
    for (const line of sectionBody.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('-')) continue
      // Bullet shapes accepted:
      //   - `<action>` — <description>
      //   - `<action>` -- <description>
      //   - <action>
      const bullet = trimmed.replace(/^-\s*/, '')
      const codeMatch = bullet.match(/^`([^`]+)`(?:\s*[—-]+\s*(.+))?$/)
      let action = ''
      let description: string | null = null
      if (codeMatch) {
        action = codeMatch[1].trim()
        description = (codeMatch[2] ?? '').trim() || null
      } else {
        action = bullet.trim()
      }
      if (!action) continue
      rules.push({
        type: meta.type,
        action,
        description,
        sortOrder: order,
        position: meta.position,
        whenExpr: null,
      })
      order += 1
    }
  }

  if (rules.length === 0) {
    return {
      ok: false,
      error: 'no rules found (expected ## Gates / ## Steps / ## Hooks / ## Instructions)',
    }
  }

  return { ok: true, workflow: { command, rules } }
}

async function listWorkflowFiles(workflowsRoot: string): Promise<string[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(workflowsRoot)
  } catch {
    return []
  }
  const out: string[] = []
  for (const entry of entries) {
    if (entry.startsWith('.') || entry.startsWith('_')) continue
    if (entry === README_FILENAME || entry === 'index.md') continue
    if (!entry.endsWith('.md')) continue
    const abs = path.join(workflowsRoot, entry)
    const stat = await fs.stat(abs)
    if (!stat.isFile()) continue
    out.push(abs)
  }
  return out
}
