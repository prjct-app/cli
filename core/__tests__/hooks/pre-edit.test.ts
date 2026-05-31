/**
 * PreToolUse(Edit|Write) hook — ANTICIPATION (RAG north star, pillar 3).
 *
 * Contract: right before a file is edited, surface ONLY the preventive
 * memory recorded against that file (gotchas / anti-patterns /
 * recurring-bugs) so the trap is seen before it's stepped in. It must be
 * quiet by design — no projectId, no file, or no preventive match → null,
 * so it never becomes per-edit noise.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildPreEditContext } from '../../hooks/pre-edit'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import prjctDb from '../../storage/database'

let projectPath: string
let projectId: string

async function freshProject(): Promise<void> {
  projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-pre-edit-test-'))
  await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
  projectId = `test-${Math.random().toString(36).slice(2, 10)}`
  await configManager.writeConfig(projectPath, {
    projectId,
    dataPath: path.join(projectPath, '.prjct-data'),
  } as Parameters<typeof configManager.writeConfig>[1])
  await pathManager.ensureProjectStructure(projectId)
}

function insertMemory(type: string, content: string, tags: Record<string, string>): void {
  prjctDb.run(
    projectId,
    "INSERT INTO events (type, data, timestamp) VALUES (?, ?, datetime('now'))",
    `memory.remember.${type}`,
    JSON.stringify({ content, tags, provenance: 'declared' })
  )
}

afterEach(async () => {
  if (projectPath) {
    await fs.rm(projectPath, { recursive: true, force: true })
    projectPath = ''
  }
})

describe('PreToolUse pre-edit hook — buildPreEditContext', () => {
  test('returns null when the tool input has no file_path', async () => {
    await freshProject()
    insertMemory('gotcha', 'a trap', { file: 'core/x.ts' })
    expect(await buildPreEditContext({ tool_input: {} }, projectPath)).toBeNull()
  })

  test('returns null when config has no projectId', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-pre-edit-no-id-'))
    await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
    await fs.writeFile(
      path.join(projectPath, '.prjct', 'prjct.config.json'),
      JSON.stringify({ dataPath: '' })
    )
    const ctx = await buildPreEditContext({ tool_input: { file_path: 'core/x.ts' } }, projectPath)
    expect(ctx).toBeNull()
  })

  test('returns null (quiet) when no preventive memory matches the file', async () => {
    await freshProject()
    insertMemory('decision', 'use bun runtime', { file: 'core/x.ts' })
    const ctx = await buildPreEditContext({ tool_input: { file_path: 'core/x.ts' } }, projectPath)
    expect(ctx).toBeNull()
  })

  test('injects a heads-up block when a gotcha targets the edited file', async () => {
    await freshProject()
    insertMemory('gotcha', 'stale daemon caches old hook code; stop it before testing', {
      file: 'core/daemon/daemon.ts',
    })
    const ctx = await buildPreEditContext(
      { tool_input: { file_path: 'core/daemon/daemon.ts' } },
      projectPath
    )
    expect(ctx).not.toBeNull()
    expect(ctx).toContain('heads up before editing `daemon.ts`')
    expect(ctx).toContain('[gotcha]')
    expect(ctx).toContain('stale daemon')
  })

  test('matches an absolute editor path against a repo-relative file tag', async () => {
    await freshProject()
    insertMemory('gotcha', 'params metadata must use [..] not <..>', {
      file: 'core/commands/embeddings.ts',
    })
    const ctx = await buildPreEditContext(
      { tool_input: { file_path: `${projectPath}/core/commands/embeddings.ts` } },
      projectPath
    )
    expect(ctx).not.toBeNull()
    expect(ctx).toContain('embeddings.ts')
  })

  test('describes state — never prescribes a forced action', async () => {
    await freshProject()
    insertMemory('gotcha', 'a real trap on this file', { file: 'core/x.ts' })
    const ctx = await buildPreEditContext({ tool_input: { file_path: 'core/x.ts' } }, projectPath)
    expect(ctx).not.toBeNull()
    expect((ctx ?? '').toLowerCase()).not.toContain('you must')
  })
})
