/**
 * `prjct harness` install/uninstall/status.
 *
 * Behavior-focused: each test runs the command against a real tmp project
 * and asserts on the resulting filesystem state. No mocks for fs.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { HarnessCommands } from '../../commands/harness'

async function freshProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'prjct-harness-test-'))
}

const SNIPPET_START = '<!-- prjct:harness:start - DO NOT REMOVE THIS MARKER -->'
const SNIPPET_END = '<!-- prjct:harness:end - DO NOT REMOVE THIS MARKER -->'

describe('prjct harness', () => {
  let projectPath: string
  let cmd: HarnessCommands

  beforeEach(async () => {
    projectPath = await freshProject()
    cmd = new HarnessCommands()
  })

  afterEach(async () => {
    await fs.rm(projectPath, { recursive: true, force: true })
  })

  test('install creates the trio + CHECKPOINTS + appends snippet', async () => {
    const result = await cmd.install(null, projectPath, { md: true })
    expect(result.success).toBe(true)

    for (const f of [
      '.claude/agents/leader.md',
      '.claude/agents/implementer.md',
      '.claude/agents/reviewer.md',
      '.prjct/CHECKPOINTS.md',
      'CLAUDE.md',
    ]) {
      const content = await fs.readFile(path.join(projectPath, f), 'utf-8')
      expect(content.length).toBeGreaterThan(0)
    }

    const claudeMd = await fs.readFile(path.join(projectPath, 'CLAUDE.md'), 'utf-8')
    expect(claudeMd).toContain(SNIPPET_START)
    expect(claudeMd).toContain(SNIPPET_END)
    expect(claudeMd).toContain('Harness leader mode')
  })

  test('install preserves existing CLAUDE.md content', async () => {
    const original = '# My project\n\nSome existing instructions.\n'
    await fs.writeFile(path.join(projectPath, 'CLAUDE.md'), original, 'utf-8')

    await cmd.install(null, projectPath, { md: true })

    const claudeMd = await fs.readFile(path.join(projectPath, 'CLAUDE.md'), 'utf-8')
    expect(claudeMd).toContain('# My project')
    expect(claudeMd).toContain('Some existing instructions.')
    expect(claudeMd).toContain(SNIPPET_START)
  })

  test('install is idempotent — does not duplicate the snippet', async () => {
    await cmd.install(null, projectPath, { md: true })
    await cmd.install(null, projectPath, { md: true })

    const claudeMd = await fs.readFile(path.join(projectPath, 'CLAUDE.md'), 'utf-8')
    const startMatches = claudeMd.match(/prjct:harness:start/g) ?? []
    const endMatches = claudeMd.match(/prjct:harness:end/g) ?? []
    expect(startMatches.length).toBe(1)
    expect(endMatches.length).toBe(1)
  })

  test('install does not overwrite an existing CHECKPOINTS.md', async () => {
    const existingPath = path.join(projectPath, '.prjct/CHECKPOINTS.md')
    await fs.mkdir(path.dirname(existingPath), { recursive: true })
    await fs.writeFile(existingPath, '# my custom checkpoints\n', 'utf-8')

    await cmd.install(null, projectPath, { md: true })

    const content = await fs.readFile(existingPath, 'utf-8')
    expect(content).toBe('# my custom checkpoints\n')
  })

  test('uninstall removes the trio + CHECKPOINTS + strips snippet', async () => {
    await cmd.install(null, projectPath, { md: true })
    const result = await cmd.uninstall(null, projectPath, { md: true })
    expect(result.success).toBe(true)

    for (const f of [
      '.claude/agents/leader.md',
      '.claude/agents/implementer.md',
      '.claude/agents/reviewer.md',
      '.prjct/CHECKPOINTS.md',
    ]) {
      const exists = await fs
        .access(path.join(projectPath, f))
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(false)
    }

    const claudeMd = await fs.readFile(path.join(projectPath, 'CLAUDE.md'), 'utf-8')
    expect(claudeMd).not.toContain(SNIPPET_START)
    expect(claudeMd).not.toContain(SNIPPET_END)
  })

  test('uninstall preserves non-harness content in CLAUDE.md', async () => {
    const original = '# My project\n\nSome existing instructions.\n'
    await fs.writeFile(path.join(projectPath, 'CLAUDE.md'), original, 'utf-8')

    await cmd.install(null, projectPath, { md: true })
    await cmd.uninstall(null, projectPath, { md: true })

    const claudeMd = await fs.readFile(path.join(projectPath, 'CLAUDE.md'), 'utf-8')
    expect(claudeMd).toContain('# My project')
    expect(claudeMd).toContain('Some existing instructions.')
    expect(claudeMd).not.toContain('prjct:harness')
  })

  test('uninstall preserves unrelated agents in .claude/agents/', async () => {
    const userAgent = path.join(projectPath, '.claude/agents/my-agent.md')
    await fs.mkdir(path.dirname(userAgent), { recursive: true })
    await fs.writeFile(userAgent, '# my agent\n', 'utf-8')

    await cmd.install(null, projectPath, { md: true })
    await cmd.uninstall(null, projectPath, { md: true })

    const stillExists = await fs
      .access(userAgent)
      .then(() => true)
      .catch(() => false)
    expect(stillExists).toBe(true)
  })

  test('status reports complete=false on a fresh project', async () => {
    const result = await cmd.status(null, projectPath, { md: true })
    expect(result.success).toBe(true)
    expect(result.complete).toBe(false)
  })

  test('status reports complete=true after install', async () => {
    await cmd.install(null, projectPath, { md: true })
    const result = await cmd.status(null, projectPath, { md: true })
    expect(result.success).toBe(true)
    expect(result.complete).toBe(true)
  })

  test('status reports complete=false if any piece is missing', async () => {
    await cmd.install(null, projectPath, { md: true })
    await fs.rm(path.join(projectPath, '.claude/agents/leader.md'))
    const result = await cmd.status(null, projectPath, { md: true })
    expect(result.complete).toBe(false)
  })
})
