/**
 * SessionStart hook — context injection invariants.
 *
 * The hook output is reused by SubagentStart and CwdChanged, both of
 * which can fire mid-session. Lock down the cache-stability contract:
 * the body is **bytes-identical given the same persona**, no
 * memory-dependent variation. Earlier versions interpolated the last
 * 5 memory entries into the body, which busted Anthropic's prompt
 * cache every time the user captured/remembered/shipped between
 * sessions or cd'd between projects (~150–400 tokens of prefix
 * change → full system-prompt re-tokenization).
 *
 * Locked invariants:
 *   1. No projectId in config → returns null (skip injection).
 *   2. No persona → returns null. Per-turn topical recall is the
 *      prompt hook's job; SessionStart is persona-only.
 *   3. Persona present → injects persona section verbatim.
 *   4. Output is "describe state" — never "do this".
 *   5. Output bytes do NOT depend on memory state (cache stability).
 */

import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildSessionContext } from '../../hooks/session-start'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import prjctDb from '../../storage/database'

let projectPath: string
let projectId: string

async function freshProject(persona?: Record<string, unknown>): Promise<void> {
  projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-session-start-test-'))
  await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
  projectId = `test-${Math.random().toString(36).slice(2, 10)}`
  await configManager.writeConfig(projectPath, {
    projectId,
    dataPath: path.join(projectPath, '.prjct-data'),
    ...(persona ? { persona } : {}),
  } as Parameters<typeof configManager.writeConfig>[1])
  await pathManager.ensureProjectStructure(projectId)
}

function insertMemory(type: string, content: string): void {
  prjctDb.run(
    projectId,
    "INSERT INTO events (type, data, timestamp) VALUES (?, ?, datetime('now'))",
    `memory.remember.${type}`,
    JSON.stringify({ content, tags: {}, provenance: 'declared' })
  )
}

afterEach(async () => {
  if (projectPath) {
    await fs.rm(projectPath, { recursive: true, force: true })
    projectPath = ''
  }
})

describe('SessionStart hook — buildSessionContext', () => {
  test('returns null when config has no projectId', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-no-id-'))
    await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
    await fs.writeFile(
      path.join(projectPath, '.prjct', 'prjct.config.json'),
      JSON.stringify({ dataPath: '' })
    )
    const ctx = await buildSessionContext(projectPath)
    expect(ctx).toBeNull()
  })

  test('returns null when no persona is configured', async () => {
    await freshProject()
    const ctx = await buildSessionContext(projectPath)
    expect(ctx).toBeNull()
  })

  test('returns null when persona is missing even if memory exists', async () => {
    // Prior versions injected a "Recent memory" section in this case.
    // That broke cache stability and is no longer surfaced from this
    // hook (UserPromptSubmit handles per-turn recall).
    await freshProject()
    insertMemory('decision', 'we picked SQLite for local-first')
    const ctx = await buildSessionContext(projectPath)
    expect(ctx).toBeNull()
  })

  test('injects persona block with role/focus/MCPs/packs', async () => {
    await freshProject({
      role: 'PM',
      focus: 'B2B onboarding',
      mcps: ['linear', 'posthog'],
      packs: ['pm', 'daily'],
    })
    const ctx = await buildSessionContext(projectPath)
    expect(ctx).not.toBeNull()
    expect(ctx).toContain('# prjct: project context')
    expect(ctx).toContain('Your role in this project: **PM**')
    expect(ctx).toContain('Focus: B2B onboarding')
    expect(ctx).toContain('Available MCPs this project expects: linear, posthog')
    expect(ctx).toContain('Active packs: pm, daily')
  })

  test('always emits the "state, not prescription" disclaimer', async () => {
    await freshProject({ role: 'DEV' })
    const ctx = await buildSessionContext(projectPath)
    expect(ctx).toContain('Exposed as state, not prescription')
  })

  test('points the model at on-demand recall (`prjct context memory`)', async () => {
    await freshProject({ role: 'DEV' })
    const ctx = await buildSessionContext(projectPath)
    expect(ctx).toContain('prjct context memory')
  })

  test('NEVER includes memory entry content (cache-stability invariant)', async () => {
    await freshProject({ role: 'DEV' })
    insertMemory('decision', 'we picked SQLite for local-first')
    insertMemory('learning', 'JWT iat detects replay')
    const ctx = await buildSessionContext(projectPath)
    expect(ctx).not.toBeNull()
    expect(ctx).not.toContain('## Recent memory')
    expect(ctx).not.toContain('SQLite for local-first')
    expect(ctx).not.toContain('JWT iat detects replay')
    expect(ctx).not.toContain('### DECISION')
    expect(ctx).not.toContain('### LEARNING')
  })

  test('output is bytes-identical regardless of memory state (cache stability)', async () => {
    await freshProject({ role: 'DEV', focus: 'platform' })
    const before = await buildSessionContext(projectPath)

    // Add a bunch of memory entries — none should leak into the output.
    for (let i = 0; i < 10; i++) {
      insertMemory('decision', `entry ${i}: ${'x'.repeat(50)}`)
    }
    const after = await buildSessionContext(projectPath)

    expect(after).toBe(before)
  })
})
