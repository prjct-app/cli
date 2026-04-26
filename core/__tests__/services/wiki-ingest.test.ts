/**
 * Wiki Ingest — captured-notes pipeline invariants.
 *
 * The ingest path runs USER-AUTHORED markdown into project memory. A
 * regression here either swallows user data silently, ingests garbage,
 * or leaks secrets into SQLite. Lock down:
 *
 *   1. Frontmatter parsing — valid note ingests with type + tags + body.
 *   2. Type validation — invalid type (uppercase, spaces, empty) is
 *      skipped with a clear reason; the file stays in inbox for retry.
 *   3. No frontmatter — file skipped, no ingest, no crash.
 *   4. Body fidelity — what gets stored as `content` is the body, not
 *      the frontmatter or the `---` separators.
 *   5. Secret scanning — secret-like body is refused by default and
 *      ingested with `force: true`.
 *   6. Move to `_ingested/` — successful ingests vacate the inbox.
 *   7. Idempotency — empty `captured/` is a clean no-op.
 *   8. `ensureCapturedReadme` — first call creates README; later calls
 *      preserve user edits (don't overwrite).
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import { projectMemory } from '../../memory/project-memory'
import { ensureCapturedReadme, ingestCapturedNotes } from '../../services/wiki-ingest'
import prjctDb from '../../storage/database'

let tmpRoot: string
let projectPath: string
let vaultRoot: string
let capturedRoot: string
let projectId: string

const spies: Array<ReturnType<typeof spyOn>> = []

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-wiki-ingest-'))
  projectPath = path.join(tmpRoot, 'proj')
  vaultRoot = path.join(tmpRoot, 'vault')
  capturedRoot = path.join(vaultRoot, 'captured')
  projectId = `ingest-${Math.random().toString(36).slice(2, 10)}`

  await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
  await configManager.writeConfig(projectPath, {
    projectId,
    dataPath: path.join(projectPath, '.prjct-data'),
  })
  await fs.mkdir(capturedRoot, { recursive: true })

  // Sandbox: redirect vault path + global storage into tmpRoot so the
  // user's real ~/Documents/prjct and ~/.prjct-cli/projects are untouched.
  spies.push(spyOn(pathManager, 'getWikiPath').mockImplementation(async () => vaultRoot))
  spies.push(
    spyOn(pathManager, 'getGlobalProjectPath').mockImplementation((pid: string) =>
      path.join(tmpRoot, 'globals', pid)
    )
  )
  spies.push(
    spyOn(pathManager, 'getFilePath').mockImplementation(
      (pid: string, layer: string, filename: string) =>
        path.join(tmpRoot, 'globals', pid, layer, filename)
    )
  )

  await fs.mkdir(path.join(tmpRoot, 'globals', projectId), { recursive: true })
  prjctDb.getDb(projectId)
})

afterEach(async () => {
  prjctDb.close()
  for (const s of spies) s.mockRestore()
  spies.length = 0
  ;(configManager as { clearCache?: () => void }).clearCache?.()
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

async function dropNote(name: string, body: string): Promise<string> {
  const p = path.join(capturedRoot, name)
  await fs.writeFile(p, body, 'utf-8')
  return p
}

function recallAll() {
  return projectMemory.recall(projectId, { limit: 100 })
}

// =============================================================================
// 1. Frontmatter parsing — happy path
// =============================================================================

describe('Wiki Ingest — frontmatter parsing', () => {
  test('ingests a valid note with type + tags + body', async () => {
    await dropNote(
      'auth-decision.md',
      `---
type: decision
tags:
  domain: auth
  priority: high
---

We picked JWT + refresh rotation because session storage was eating Redis.`
    )

    const result = await ingestCapturedNotes(projectPath)
    expect(result.ingested).toBe(1)
    expect(result.skipped).toEqual([])
    expect(result.errors).toEqual([])

    const entries = recallAll()
    expect(entries).toHaveLength(1)
    expect(entries[0].type).toBe('decision')
    expect(entries[0].content).toContain('JWT + refresh rotation')
    expect(entries[0].tags).toEqual({ domain: 'auth', priority: 'high' })
  })

  test('accepts inline tag syntax (`tags: k=v, k=v`)', async () => {
    await dropNote(
      'inline-tags.md',
      `---
type: gotcha
tags: domain=auth, priority=high
---

iat must be checked to detect replay.`
    )
    const result = await ingestCapturedNotes(projectPath)
    expect(result.ingested).toBe(1)
    const [entry] = recallAll()
    expect(entry.tags).toEqual({ domain: 'auth', priority: 'high' })
  })

  test('body fidelity — multi-line body is preserved verbatim', async () => {
    const body = `Line one.

Line three after a blank.

\`\`\`ts
const x = 1
\`\`\`

End.`
    await dropNote(
      'multi.md',
      `---
type: learning
---

${body}`
    )
    await ingestCapturedNotes(projectPath)
    const [entry] = recallAll()
    expect(entry.content).toBe(body)
    expect(entry.content).not.toContain('---')
    expect(entry.content).not.toContain('type:')
  })
})

// =============================================================================
// 2. Validation failures — file stays in inbox
// =============================================================================

describe('Wiki Ingest — validation', () => {
  test('rejects type with disallowed characters (space) and leaves file in place', async () => {
    // The parser lowercases `type` before validating, so capitalisation
    // alone is forgiven. Anything the regex rejects (spaces, underscores,
    // leading digits) must still bounce.
    const filePath = await dropNote(
      'bad-type.md',
      `---
type: my type
---

content`
    )
    const result = await ingestCapturedNotes(projectPath)
    expect(result.ingested).toBe(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].file).toBe('bad-type.md')
    expect(result.skipped[0].reason).toContain('invalid type')
    // File must NOT have moved — user can fix and retry.
    await expect(fs.stat(filePath)).resolves.toBeTruthy()
    expect(recallAll()).toHaveLength(0)
  })

  test('skips note without frontmatter', async () => {
    await dropNote('no-frontmatter.md', 'just a body, no metadata.\n')
    const result = await ingestCapturedNotes(projectPath)
    expect(result.ingested).toBe(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].reason).toContain('no frontmatter')
    expect(recallAll()).toHaveLength(0)
  })

  test('skips note missing type even when frontmatter exists', async () => {
    await dropNote(
      'no-type.md',
      `---
tags:
  domain: auth
---

body`
    )
    const result = await ingestCapturedNotes(projectPath)
    expect(result.ingested).toBe(0)
    expect(result.skipped[0].reason).toContain('missing `type`')
  })

  test('skips note with empty body', async () => {
    await dropNote(
      'empty-body.md',
      `---
type: learning
---
`
    )
    const result = await ingestCapturedNotes(projectPath)
    expect(result.ingested).toBe(0)
    expect(result.skipped[0].reason).toContain('body is empty')
  })
})

// =============================================================================
// 3. Secret scanning
// =============================================================================

describe('Wiki Ingest — secret scanning', () => {
  test('refuses note with AWS-key-shaped content by default', async () => {
    const filePath = await dropNote(
      'leak.md',
      `---
type: learning
---

The key was AKIAIOSFODNN7EXAMPLE — we rotated it.`
    )
    const result = await ingestCapturedNotes(projectPath)
    expect(result.ingested).toBe(0)
    expect(result.skipped[0].reason).toContain('secret-like')
    expect(result.skipped[0].reason).toContain('AWS access key')
    // File preserved so the user can sanitize and retry.
    await expect(fs.stat(filePath)).resolves.toBeTruthy()
    expect(recallAll()).toHaveLength(0)
  })

  test('ingests secret-like note when force=true (explicit user override)', async () => {
    await dropNote(
      'leak.md',
      `---
type: learning
---

The key was AKIAIOSFODNN7EXAMPLE — we rotated it.`
    )
    const result = await ingestCapturedNotes(projectPath, { force: true })
    expect(result.ingested).toBe(1)
    expect(result.skipped).toEqual([])
    expect(recallAll()).toHaveLength(1)
  })
})

// =============================================================================
// 4. Move to _ingested/ + idempotency
// =============================================================================

describe('Wiki Ingest — archive + idempotency', () => {
  test('moves successfully ingested notes into _ingested/<timestamp>/', async () => {
    const filePath = await dropNote(
      'good.md',
      `---
type: decision
---

ok`
    )
    await ingestCapturedNotes(projectPath)

    // Original file is gone from the inbox.
    await expect(fs.stat(filePath)).rejects.toThrow()

    // It now lives under _ingested/<timestamp>/good.md.
    const ingestedRoot = path.join(capturedRoot, '_ingested')
    const stamps = await fs.readdir(ingestedRoot)
    expect(stamps.length).toBeGreaterThan(0)
    const moved = path.join(ingestedRoot, stamps[0], 'good.md')
    await expect(fs.stat(moved)).resolves.toBeTruthy()
  })

  test('empty captured/ → no-op, no errors', async () => {
    const result = await ingestCapturedNotes(projectPath)
    expect(result).toEqual({ ingested: 0, skipped: [], errors: [] })
  })

  test('listNoteFiles ignores README, dotfiles, and the _ingested/ subdir', async () => {
    await fs.writeFile(path.join(capturedRoot, 'README.md'), '# readme', 'utf-8')
    await fs.writeFile(path.join(capturedRoot, '.hidden.md'), 'shh', 'utf-8')
    await fs.mkdir(path.join(capturedRoot, '_ingested', 'old-stamp'), { recursive: true })
    await fs.writeFile(path.join(capturedRoot, '_ingested', 'old-stamp', 'old.md'), 'old', 'utf-8')

    const result = await ingestCapturedNotes(projectPath)
    expect(result).toEqual({ ingested: 0, skipped: [], errors: [] })
  })
})

// =============================================================================
// 5. ensureCapturedReadme
// =============================================================================

describe('ensureCapturedReadme', () => {
  test('creates README on first call', async () => {
    await ensureCapturedReadme(projectPath)
    const body = await fs.readFile(path.join(capturedRoot, 'README.md'), 'utf-8')
    expect(body).toContain('Captured notes')
    expect(body).toContain('type: learning')
  })

  test('preserves user edits on subsequent calls', async () => {
    await ensureCapturedReadme(projectPath)
    const customised = '# my own notes — do not overwrite'
    await fs.writeFile(path.join(capturedRoot, 'README.md'), customised, 'utf-8')

    await ensureCapturedReadme(projectPath)
    const body = await fs.readFile(path.join(capturedRoot, 'README.md'), 'utf-8')
    expect(body).toBe(customised)
  })
})
