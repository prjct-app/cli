/**
 * SubagentStart hook — compact digest invariants.
 *
 * Subagents receive `buildSubagentDigest`, not the full session context:
 * role + this worktree's active task + top preventive traps, hard-capped
 * at 500 chars. Emitted via `systemMessage` (outside the cached prompt
 * prefix), so variable content is allowed here — unlike SessionStart.
 *
 * Locked invariants:
 *   1. No projectId in config → null (skip injection).
 *   2. No persona, no task, no traps → null (nothing to say).
 *   3. Gotchas/anti-patterns surface as traps; other types do not.
 *   4. Output never exceeds the 500-char cap.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildSubagentDigest } from '../../hooks/session-start'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import prjctDb from '../../storage/database'

let projectPath: string
let projectId: string

async function freshProject(persona?: Record<string, unknown>): Promise<void> {
  projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-subagent-start-test-'))
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

describe('SubagentStart hook — buildSubagentDigest', () => {
  test('returns null when config has no projectId', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-subagent-no-id-'))
    await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
    await fs.writeFile(
      path.join(projectPath, '.prjct', 'prjct.config.json'),
      JSON.stringify({ dataPath: '' })
    )
    const ctx = await buildSubagentDigest(projectPath)
    expect(ctx).toBeNull()
  })

  test('returns null when there is nothing to say', async () => {
    await freshProject()
    const ctx = await buildSubagentDigest(projectPath)
    expect(ctx).toBeNull()
  })

  test('includes persona role when configured', async () => {
    await freshProject({ role: 'backend specialist' })
    const ctx = await buildSubagentDigest(projectPath)
    expect(ctx).toContain('backend specialist')
  })

  test('surfaces gotchas as traps', async () => {
    await freshProject()
    insertMemory('gotcha', 'The daemon caches stale hook code until restarted')
    const ctx = await buildSubagentDigest(projectPath)
    expect(ctx).toContain('Traps to avoid')
    expect(ctx).toContain('daemon caches stale hook code')
  })

  test('does not surface non-preventive memory types', async () => {
    await freshProject()
    insertMemory('decision', 'We chose SQLite over JSON files')
    const ctx = await buildSubagentDigest(projectPath)
    expect(ctx).toBeNull()
  })

  test('never exceeds the 500-char cap', async () => {
    await freshProject({ role: 'fullstack' })
    for (let i = 0; i < 5; i++) {
      insertMemory('gotcha', `Very long trap description number ${i} — ${'x'.repeat(300)}`)
    }
    const ctx = await buildSubagentDigest(projectPath)
    expect(ctx).not.toBeNull()
    expect((ctx as string).length).toBeLessThanOrEqual(500)
  })
})
