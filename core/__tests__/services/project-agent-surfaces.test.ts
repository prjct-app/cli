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
    expect(agents).toContain('single normal entrypoint')
    expect(agents).toContain('persisted intent brief')
    expect(agents).toContain('second brain')
    expect(agents).toContain('RAG-backed project memory harness')
    expect(agents).toContain('Do not preload project history')
    expect(agents).toContain('Pull more context on demand')
    expect(agents).toContain('not something to load wholesale')
    expect(agents).toContain('Raw quotes')
    expect(agents).toContain('not durable context')
    expect(agents).toContain('prjct_*')
  })

  it('keeps the Claude project surface when Claude is selected', async () => {
    const result = await writeProjectAgentSurfaces(dir, { agents: ['claude'] })

    expect(result.claudeMd?.action).toBe('created')
    const claude = await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf-8')
    expect(claude).toContain('prjct usage')
    expect(claude).toContain('prjct work')
    expect(claude).toContain('RAG-backed project memory harness')
    expect(claude).toContain('Do not preload project history')
    expect(claude).toContain('Pull more context on demand')
    expect(claude).toContain('not something to load wholesale')
  })

  it('writes known project rule adapters when selected', async () => {
    const result = await writeProjectAgentSurfaces(dir, { agents: ['cursor', 'windsurf'] })

    expect(result.ideRules).toEqual(['.cursor/rules/prjct.mdc', '.windsurf/rules/prjct.md'])
    const cursor = await fs.readFile(path.join(dir, '.cursor', 'rules', 'prjct.mdc'), 'utf-8')
    const windsurf = await fs.readFile(path.join(dir, '.windsurf', 'rules', 'prjct.md'), 'utf-8')
    for (const body of [cursor, windsurf]) {
      expect(body).toContain('RAG-backed project memory harness')
      expect(body).toContain('do not preload project history')
      expect(body).toContain('Pull only relevant context')
      expect(body).toContain('not something to load wholesale')
    }
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
