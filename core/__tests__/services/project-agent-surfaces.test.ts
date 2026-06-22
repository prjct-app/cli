import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { writeProjectAgentSurfaces } from '../../services/project-agent-surfaces'

let dir: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-agent-surfaces-test-'))
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
})

describe('writeProjectAgentSurfaces', () => {
  it('always writes AGENTS.md as the universal agent surface', async () => {
    const result = await writeProjectAgentSurfaces(dir)

    expect(result.agentsMd.action).toBe('created')
    const agents = await fs.readFile(path.join(dir, 'AGENTS.md'), 'utf-8')
    expect(agents).toContain('prjct status done')
    expect(agents).toContain('prjct_*')
  })

  it('keeps the Claude project surface when Claude is selected', async () => {
    const result = await writeProjectAgentSurfaces(dir, { agents: ['claude'] })

    expect(result.claudeMd?.action).toBe('created')
    const claude = await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf-8')
    expect(claude).toContain('prjct usage')
    expect(claude).toContain('status done')
  })

  it('writes known project rule adapters when selected', async () => {
    const result = await writeProjectAgentSurfaces(dir, { agents: ['cursor', 'windsurf'] })

    expect(result.ideRules).toEqual(['.cursor/rules/prjct.mdc', '.windsurf/rules/prjct.md'])
    await expect(fs.stat(path.join(dir, '.cursor', 'rules', 'prjct.mdc'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(dir, '.windsurf', 'rules', 'prjct.md'))).resolves.toBeTruthy()
  })

  it('does not invent project files for runtimes covered by AGENTS.md only', async () => {
    const result = await writeProjectAgentSurfaces(dir, {
      agents: ['opencode', 'qwen-code', 'cline'],
    })

    expect(result.ideRules).toEqual([])
    const entries = await fs.readdir(dir)
    expect(entries).toEqual(['AGENTS.md'])
  })
})
