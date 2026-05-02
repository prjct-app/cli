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
import configManager from '../infrastructure/config-manager'
import { MEMORY_TYPES, type MemoryType, projectMemory } from '../memory/project-memory'
import { scanForSecrets } from '../memory/secret-scanner'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import type { WorkflowRule } from '../types/storage'
import { resolveVaultRoot } from './wiki-migration'

const CAPTURED_SUBDIR = 'captured'
const WORKFLOWS_SUBDIR = 'workflows'
const INGESTED_SUBDIR = '_ingested'
const README_FILENAME = 'README.md'

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

// =============================================================================
// Workflow ingest (M1b INPUT half) — bidirectional editing of workflows
// from <vault>/workflows/<command>.md.
//
// Pattern mirrors captured/: user drops a .md, Stop hook ingests, file is
// archived to workflows/_ingested/<timestamp>/. Difference: workflow
// ingest REPLACES the SQLite rules for that command rather than appending.
// =============================================================================

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
export async function ingestWorkflowEdits(projectPath: string): Promise<WorkflowIngestResult> {
  const result: WorkflowIngestResult = { ingested: [], skipped: [], errors: [] }
  const config = await configManager.readConfig(projectPath).catch(() => null)
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
