/**
 * Project CLAUDE.md routing block — written by `prjct init`.
 *
 * Pins the contract:
 *   1. Missing CLAUDE.md → file is created with the block.
 *   2. Existing CLAUDE.md without markers → block appended,
 *      user content preserved.
 *   3. Existing CLAUDE.md with stale markers → block content refreshed,
 *      user content outside markers preserved.
 *   4. Re-running on already-current file → action='unchanged'
 *      (idempotent — `prjct init` is safe to re-run).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _routing, writeProjectClaudeMd } from '../../services/project-claude-md'

let dir: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-claude-md-test-'))
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
})

async function readClaudeMd(): Promise<string> {
  return fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf-8')
}

describe('writeProjectClaudeMd', () => {
  it('creates CLAUDE.md when none exists', async () => {
    const r = await writeProjectClaudeMd(dir)
    expect(r.action).toBe('created')
    const body = await readClaudeMd()
    expect(body).toContain(_routing.START_MARKER)
    expect(body).toContain(_routing.END_MARKER)
    expect(body).toContain('## prjct usage')
    expect(body).toContain('Do not ask the\nuser to run prjct commands')
    expect(body).toContain('RAG-backed project memory harness')
    expect(body).toContain('Do not preload project history')
    expect(body).toContain('Pull more context on demand')
    expect(body).toContain('not something to load wholesale')
  })

  it('appends the block to an existing CLAUDE.md without markers', async () => {
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), '# My Project\n\nExisting notes.\n')
    const r = await writeProjectClaudeMd(dir)
    expect(r.action).toBe('updated')
    const body = await readClaudeMd()
    expect(body).toContain('# My Project')
    expect(body).toContain('Existing notes.')
    expect(body).toContain(_routing.START_MARKER)
    // Original content survives.
    expect(body.indexOf('Existing notes.')).toBeLessThan(body.indexOf(_routing.START_MARKER))
  })

  it('replaces stale block content while preserving the user content outside markers', async () => {
    const initialBody = `# My Project

Custom rules.

${_routing.START_MARKER}
old stale routing instructions
${_routing.END_MARKER}

## More user content
trailing notes here
`
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), initialBody)
    const r = await writeProjectClaudeMd(dir)
    expect(r.action).toBe('updated')
    const body = await readClaudeMd()
    // The user-authored content survives unchanged.
    expect(body).toContain('Custom rules.')
    expect(body).toContain('trailing notes here')
    // Old stale content is gone.
    expect(body).not.toContain('old stale routing instructions')
    // New block is in place.
    expect(body).toContain('Do not ask the\nuser to run prjct commands')
  })

  it('is idempotent — second run on a current file reports unchanged', async () => {
    await writeProjectClaudeMd(dir)
    const second = await writeProjectClaudeMd(dir)
    expect(second.action).toBe('unchanged')
  })
})
