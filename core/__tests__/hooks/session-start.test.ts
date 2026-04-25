/**
 * SessionStart hook — context injection invariants.
 *
 * The session-start hook runs on every Claude session boot. Its output
 * is the first thing the model reads, and a regression here silently
 * degrades context for every project. Lock down:
 *
 *   1. No projectId in config → returns null (skip injection entirely).
 *   2. No persona AND no memory → returns null (don't inject empty noise).
 *   3. Persona only → injects persona section with role/focus/MCPs/packs.
 *   4. Memory only → injects memory section with recent entries.
 *   5. Both → both sections present, in the documented order.
 *   6. Output is "describe state" — never "do this": contains the
 *      "Exposed as state, not prescription" disclaimer.
 *   7. Body is truncated when over MAX_CHARS so noisy projects don't
 *      blow Claude's context budget.
 *   8. Memory recall failure degrades gracefully: persona still injected.
 */

import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildSessionContext } from '../../hooks/session-start'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import { projectMemory } from '../../memory/project-memory'
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

  test('returns null when neither persona nor memory exists', async () => {
    await freshProject()
    const ctx = await buildSessionContext(projectPath)
    expect(ctx).toBeNull()
  })

  test('injects persona-only block when no memory', async () => {
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
    expect(ctx).not.toContain('## Recent memory')
  })

  test('injects memory-only block when no persona', async () => {
    await freshProject()
    insertMemory('decision', 'we picked SQLite for local-first')
    insertMemory('learning', 'JWT iat detects replay')
    const ctx = await buildSessionContext(projectPath)
    expect(ctx).not.toBeNull()
    expect(ctx).toContain('## Recent memory')
    expect(ctx).toContain('we picked SQLite for local-first')
    expect(ctx).toContain('JWT iat detects replay')
    expect(ctx).not.toContain('Your role in this project')
  })

  test('injects persona then memory when both present', async () => {
    await freshProject({ role: 'DEV', mcps: [], packs: [] })
    insertMemory('decision', 'monorepo via bun workspaces')
    const ctx = await buildSessionContext(projectPath)
    expect(ctx).not.toBeNull()
    const personaIdx = ctx!.indexOf('Your role in this project')
    const memoryIdx = ctx!.indexOf('## Recent memory')
    expect(personaIdx).toBeGreaterThan(-1)
    expect(memoryIdx).toBeGreaterThan(personaIdx)
  })

  test('always emits the "state, not prescription" disclaimer', async () => {
    await freshProject({ role: 'DEV' })
    const ctx = await buildSessionContext(projectPath)
    expect(ctx).toContain('Exposed as state, not prescription. Decide whether any of this matters')
  })

  test('truncates body when over MAX_CHARS (2500)', async () => {
    await freshProject({ role: 'DEV' })
    // Recall caps at 5 entries; pad each so total comfortably exceeds 2500.
    for (let i = 0; i < 5; i++) {
      insertMemory('learning', `entry ${i}: ${'x'.repeat(700)}`)
    }
    const ctx = await buildSessionContext(projectPath)
    expect(ctx).not.toBeNull()
    expect(ctx!.length).toBeLessThanOrEqual(2500)
    expect(ctx).toContain('… [truncated]')
  })

  test('memory recall failure degrades gracefully: persona still injected', async () => {
    await freshProject({ role: 'PM' })
    const recallSpy = spyOn(projectMemory, 'recall').mockImplementation(() => {
      throw new Error('simulated DB failure')
    })
    try {
      const ctx = await buildSessionContext(projectPath)
      expect(ctx).not.toBeNull()
      expect(ctx).toContain('Your role in this project: **PM**')
      expect(ctx).not.toContain('## Recent memory')
    } finally {
      recallSpy.mockRestore()
    }
  })

  test('memory recall failure with no persona returns null (no empty injection)', async () => {
    await freshProject()
    const recallSpy = spyOn(projectMemory, 'recall').mockImplementation(() => {
      throw new Error('simulated DB failure')
    })
    try {
      const ctx = await buildSessionContext(projectPath)
      expect(ctx).toBeNull()
    } finally {
      recallSpy.mockRestore()
    }
  })
})
