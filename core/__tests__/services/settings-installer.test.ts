/**
 * Settings installer — safe merge into ~/.claude/settings.json.
 *
 * We redirect HOME to a temp dir per test so the real user settings
 * are never touched. `settingsPath()` resolves homedir() at call time
 * (not at module load), so no cache busting is needed.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { install, PRJCT_HOOKS, status, uninstall } from '../../services/settings-installer'

const ORIGINAL_HOME = process.env.HOME

async function freshHome(): Promise<string> {
  const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-settings-test-'))
  process.env.HOME = tmpHome
  return tmpHome
}

describe('settings-installer', () => {
  let home: string

  beforeEach(async () => {
    home = await freshHome()
  })

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true })
    if (ORIGINAL_HOME) process.env.HOME = ORIGINAL_HOME
    else delete process.env.HOME
  })

  test('install writes all hooks on a fresh settings file', async () => {
    const result = await install()
    expect(result.hooksWritten).toBe(PRJCT_HOOKS.length)
    expect(result.alreadyPresent).toBe(0)

    const raw = await fs.readFile(path.join(home, '.claude', 'settings.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.hooks).toBeDefined()
    expect(parsed.hooks.SessionStart).toBeDefined()
    expect(parsed.hooks.SessionStart[0].hooks[0]._prjctManaged).toBe(true)
  })

  test('install is idempotent — second run reports all already present', async () => {
    await install()
    const second = await install()
    expect(second.hooksWritten).toBe(0)
    expect(second.alreadyPresent).toBe(PRJCT_HOOKS.length)
  })

  test('install preserves foreign (non-prjct) hooks under the same event', async () => {
    const settingsPath = path.join(home, '.claude', 'settings.json')
    await fs.mkdir(path.dirname(settingsPath), { recursive: true })
    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        hooks: {
          SessionStart: [
            { matcher: '', hooks: [{ type: 'command', command: '/usr/local/bin/other-tool' }] },
          ],
        },
        someUserKey: 'keep-me',
      }),
      'utf-8'
    )

    await install()
    const parsed = JSON.parse(await fs.readFile(settingsPath, 'utf-8'))

    // User key preserved
    expect(parsed.someUserKey).toBe('keep-me')
    // Foreign hook preserved, prjct entry added alongside
    const sessionHooks = parsed.hooks.SessionStart[0].hooks
    expect(sessionHooks.length).toBe(2)
    expect(
      sessionHooks.some((h: { command: string }) => h.command === '/usr/local/bin/other-tool')
    ).toBe(true)
    expect(sessionHooks.some((h: { _prjctManaged?: boolean }) => h._prjctManaged === true)).toBe(
      true
    )
  })

  test('uninstall removes only prjct entries, foreign hooks survive', async () => {
    await install()

    // Inject a foreign hook under the same event
    const settingsPath = path.join(home, '.claude', 'settings.json')
    const parsed = JSON.parse(await fs.readFile(settingsPath, 'utf-8'))
    parsed.hooks.SessionStart[0].hooks.push({
      type: 'command',
      command: '/usr/local/bin/other-tool',
    })
    await fs.writeFile(settingsPath, JSON.stringify(parsed), 'utf-8')

    const result = await uninstall()
    expect(result.hooksRemoved).toBeGreaterThan(0)

    const after = JSON.parse(await fs.readFile(settingsPath, 'utf-8'))
    // Foreign hook still there
    const remaining = after.hooks?.SessionStart?.[0]?.hooks ?? []
    expect(
      remaining.some((h: { command: string }) => h.command === '/usr/local/bin/other-tool')
    ).toBe(true)
    expect(remaining.some((h: { _prjctManaged?: boolean }) => h._prjctManaged === true)).toBe(false)
  })

  test('install collapses legacy unmanaged prjct duplicates into the marked entry', async () => {
    // Simulate JJ's machine 2026-05-01: 3 unmanaged + 1 managed copies
    // accumulated from older installs that didn't tag entries.
    const settingsPath = path.join(home, '.claude', 'settings.json')
    await fs.mkdir(path.dirname(settingsPath), { recursive: true })
    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              matcher: '',
              hooks: [
                { type: 'command', command: 'prjct hook session-start' },
                { type: 'command', command: 'prjct hook session-start' },
                { type: 'command', command: 'prjct hook session-start' },
                { type: 'command', command: 'prjct hook session-start', _prjctManaged: true },
                // Foreign hook must survive
                { type: 'command', command: '/usr/local/bin/other-tool' },
              ],
            },
          ],
        },
      }),
      'utf-8'
    )

    await install()
    const parsed = JSON.parse(await fs.readFile(settingsPath, 'utf-8'))
    const sessionHooks = parsed.hooks.SessionStart[0].hooks

    // Exactly 1 prjct entry remains, and it's the marked one
    const prjctOnes = sessionHooks.filter((h: { command: string }) =>
      /prjct\s+hook\s+session-start/.test(h.command)
    )
    expect(prjctOnes.length).toBe(1)
    expect(prjctOnes[0]._prjctManaged).toBe(true)

    // Foreign hook preserved
    expect(
      sessionHooks.some((h: { command: string }) => h.command === '/usr/local/bin/other-tool')
    ).toBe(true)

    // Idempotent: second run is a no-op
    const second = await install()
    expect(second.hooksWritten).toBe(0)
    expect(second.alreadyPresent).toBe(PRJCT_HOOKS.length)
  })

  test('status reports installed count', async () => {
    await install()
    const s = await status()
    expect(s.installed).toBe(PRJCT_HOOKS.length)
    expect(s.expected).toBe(PRJCT_HOOKS.length)
  })
})
