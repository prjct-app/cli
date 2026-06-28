/**
 * PreToolUse(Edit|Write) `pre-edit` hook — the apply-loop push.
 *
 * Pins that when Claude is about to edit a file, the file's preventive memory
 * (gotchas/anti-patterns tagged to it) is surfaced as additionalContext — the
 * push that closes the loop pull-only `guard` left to the agent's instinct.
 * And that it stays SILENT (no harness) when there's nothing tagged to the
 * target file, so it never becomes noise.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runPreEditHook } from '../../hooks/pre-edit'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import { projectMemory } from '../../memory/project-memory'

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

/**
 * Drive the hook with a captured-IO bridge (the same shape the daemon uses)
 * and return the emitted stdout payload.
 */
async function runWith(toolInput: Record<string, unknown>): Promise<string> {
  let out = ''
  await runPreEditHook(projectPath, {
    input: { tool_name: 'Edit', tool_input: toolInput },
    sink: (chunk: string) => {
      out += chunk
    },
    detachAfterEmit: () => {},
  })
  return out
}

beforeEach(freshProject)
afterEach(async () => {
  if (projectPath) {
    await fs.rm(projectPath, { recursive: true, force: true })
    projectPath = ''
  }
})

describe('pre-edit hook', () => {
  test('surfaces a gotcha tagged to the file being edited', async () => {
    await projectMemory.remember(projectPath, {
      type: 'gotcha',
      content: 'this module mutates shared state — clone before writing',
      tags: { file: 'core/state.ts' },
    })
    const out = await runWith({ file_path: '/abs/repo/core/state.ts' })
    expect(out).toContain('heads-up before editing')
    expect(out).toContain('clone before writing')
  })

  test('matches by basename when the tagged path is relative', async () => {
    await projectMemory.remember(projectPath, {
      type: 'anti-pattern',
      content: 'do not call fetchAll() here, it N+1s',
      tags: { file: 'state.ts' },
    })
    const out = await runWith({ file_path: '/some/other/root/core/state.ts' })
    expect(out).toContain('fetchAll')
  })

  test('stays silent (emits {}) when nothing is tagged to the file', async () => {
    await projectMemory.remember(projectPath, {
      type: 'gotcha',
      content: 'unrelated trap in another file',
      tags: { file: 'core/other.ts' },
    })
    const out = await runWith({ file_path: '/abs/repo/core/state.ts' })
    expect(out.trim()).toBe('{}')
  })

  test('stays silent when no file_path is provided', async () => {
    const out = await runWith({})
    expect(out.trim()).toBe('{}')
  })

  test('does NOT surface non-preventive memory (decisions) for the file', async () => {
    await projectMemory.remember(projectPath, {
      type: 'decision',
      content: 'we chose this file as the entrypoint',
      tags: { file: 'core/state.ts' },
    })
    const out = await runWith({ file_path: '/abs/repo/core/state.ts' })
    expect(out.trim()).toBe('{}')
  })

  test('does NOT surface file history (context entries) — push carries only traps', async () => {
    await projectMemory.remember(projectPath, {
      type: 'context',
      content: 'this file was refactored during the token-efficiency work cycle',
      tags: { files: 'core/state.ts' },
    })
    const out = await runWith({ file_path: '/abs/repo/core/state.ts' })
    expect(out.trim()).toBe('{}')
  })
})
