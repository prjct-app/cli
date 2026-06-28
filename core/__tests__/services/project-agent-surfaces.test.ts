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
  // Clean-repo sovereignty doctrine: automatic flows (sync/install/setup/work)
  // call this WITHOUT `explicit` and must write nothing into the repo. The sole
  // repo footprint is .prjct/. Only `prjct agents` opts in via `explicit: true`.
  it('writes nothing into the repo unless explicitly asked', async () => {
    const result = await writeProjectAgentSurfaces(dir)

    expect(result.agentsMd.action).toBe('unchanged')
    expect(result.claudeMd).toBeUndefined()
    expect(result.ideRules).toEqual([])
    const entries = await fs.readdir(dir)
    expect(entries).toEqual([])
  })

  it('is still a no-op even when agents are selected but not explicit', async () => {
    const result = await writeProjectAgentSurfaces(dir, { agents: ['cursor', 'windsurf'] })

    expect(result.ideRules).toEqual([])
    expect(await fs.readdir(dir)).toEqual([])
  })

  it('writes AGENTS.md as a minimal pointer on explicit opt-in', async () => {
    const result = await writeProjectAgentSurfaces(dir, { explicit: true })

    expect(result.agentsMd.action).toBe('created')
    const agents = await fs.readFile(path.join(dir, 'AGENTS.md'), 'utf-8')
    expect(agents).toContain('prjct work --md')
    expect(agents).toContain('This file holds no rules')
    // No inlined ruleset / RAG protocol in a client-repo surface.
    expect(agents).not.toContain('RAG-backed project memory harness')
    expect(agents).not.toContain('intent brief')
  })

  it('keeps the Claude project surface when Claude is selected (explicit)', async () => {
    const result = await writeProjectAgentSurfaces(dir, { explicit: true, agents: ['claude'] })

    expect(result.claudeMd?.action).toBe('created')
    const claude = await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf-8')
    expect(claude).toContain('## prjct')
    expect(claude).toContain('prjct work --md')
    expect(claude).not.toContain('RAG-backed project memory harness')
  })

  it('writes known project rule adapters as minimal pointers when selected (explicit)', async () => {
    const result = await writeProjectAgentSurfaces(dir, {
      explicit: true,
      agents: ['cursor', 'windsurf'],
    })

    expect(result.ideRules).toEqual(['.cursor/rules/prjct.mdc', '.windsurf/rules/prjct.md'])
    const cursor = await fs.readFile(path.join(dir, '.cursor', 'rules', 'prjct.mdc'), 'utf-8')
    const windsurf = await fs.readFile(path.join(dir, '.windsurf', 'rules', 'prjct.md'), 'utf-8')
    for (const body of [cursor, windsurf]) {
      expect(body).toContain('prjct work --md')
      expect(body).toContain('This file holds no rules')
      expect(body).not.toContain('RAG-backed project memory harness')
      expect(body).not.toContain('Pull only relevant context')
    }
  })

  it('does not invent project files for runtimes covered by AGENTS.md only (explicit)', async () => {
    const result = await writeProjectAgentSurfaces(dir, {
      explicit: true,
      agents: ['opencode', 'qwen-code', 'cline'],
    })

    expect(result.ideRules).toEqual([])
    const entries = await fs.readdir(dir)
    expect(entries).toEqual(['AGENTS.md'])
  })
})
