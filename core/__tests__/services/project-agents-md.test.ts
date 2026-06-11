/**
 * Project AGENTS.md routing block — written by `prjct init` when Codex
 * is detected (or wizard-selected). Mirrors the CLAUDE.md contract:
 *   1. Missing AGENTS.md → created with the block.
 *   2. Existing AGENTS.md without markers → block appended, user content
 *      preserved (this repo's own handwritten AGENTS.md is the canary).
 *   3. Stale markers → refreshed in place.
 *   4. Re-run on current file → action='unchanged' (idempotent).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _routing, writeProjectAgentsMd } from '../../services/project-agents-md'

let dir: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-agents-md-test-'))
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
})

async function readAgentsMd(): Promise<string> {
  return fs.readFile(path.join(dir, 'AGENTS.md'), 'utf-8')
}

describe('writeProjectAgentsMd', () => {
  it('creates AGENTS.md when none exists', async () => {
    const r = await writeProjectAgentsMd(dir)
    expect(r.action).toBe('created')
    const body = await readAgentsMd()
    expect(body).toContain(_routing.START_MARKER)
    expect(body).toContain(_routing.END_MARKER)
    expect(body).toContain('## prjct — project memory & workflow')
    expect(body).toContain('prjct task')
  })

  it('appends the block to an existing AGENTS.md without markers', async () => {
    await fs.writeFile(
      path.join(dir, 'AGENTS.md'),
      '# Contributor guide\n\nHandwritten conventions.\n'
    )
    const r = await writeProjectAgentsMd(dir)
    expect(r.action).toBe('updated')
    const body = await readAgentsMd()
    expect(body).toContain('# Contributor guide')
    expect(body).toContain('Handwritten conventions.')
    expect(body).toContain(_routing.START_MARKER)
    expect(body.indexOf('Handwritten conventions.')).toBeLessThan(
      body.indexOf(_routing.START_MARKER)
    )
  })

  it('refreshes a stale block between markers, preserving outside content', async () => {
    const stale = `# Mine\n\n${_routing.START_MARKER}\nOLD CONTENT\n${_routing.END_MARKER}\n\nTrailing notes.\n`
    await fs.writeFile(path.join(dir, 'AGENTS.md'), stale)
    const r = await writeProjectAgentsMd(dir)
    expect(r.action).toBe('updated')
    const body = await readAgentsMd()
    expect(body).not.toContain('OLD CONTENT')
    expect(body).toContain('# Mine')
    expect(body).toContain('Trailing notes.')
    expect(body).toContain('## prjct — project memory & workflow')
  })

  it('is idempotent — re-run reports unchanged', async () => {
    await writeProjectAgentsMd(dir)
    const first = await readAgentsMd()
    const r = await writeProjectAgentsMd(dir)
    expect(r.action).toBe('unchanged')
    expect(await readAgentsMd()).toBe(first)
  })

  it('block is vendor-neutral — no Claude-only paths', async () => {
    await writeProjectAgentsMd(dir)
    const body = await readAgentsMd()
    expect(body).not.toContain('.claude/')
    expect(body).not.toContain('Claude Code')
  })
})
