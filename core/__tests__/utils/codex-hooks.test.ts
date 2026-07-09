/**
 * Codex hooks installer — maps PRJCT_HOOKS → ~/.codex/hooks.json + features.hooks.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  codexHookSpecs,
  codexHooksStatus,
  ensureCodexHooksFeature,
  installCodexHooks,
  uninstallCodexHooks,
} from '../../utils/codex-hooks'

let dir: string
let hooksPath: string
let configPath: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-codex-hooks-test-'))
  hooksPath = path.join(dir, 'hooks.json')
  configPath = path.join(dir, 'config.toml')
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
})

describe('codexHookSpecs', () => {
  it('skips Claude-only Notification and CwdChanged events', () => {
    const events = new Set(codexHookSpecs().map((s) => s.event))
    expect(events.has('SessionStart')).toBe(true)
    expect(events.has('PreToolUse')).toBe(true)
    expect(events.has('UserPromptSubmit')).toBe(true)
    expect(events.has('Stop')).toBe(true)
    expect(events.has('Notification')).toBe(false)
    expect(events.has('CwdChanged')).toBe(false)
  })
})

describe('installCodexHooks', () => {
  it('creates hooks.json with managed handlers for every Codex-capable event', async () => {
    const r = await installCodexHooks({ hooksPath, configPath })
    expect(r.hooksWritten).toBeGreaterThan(0)
    expect(r.featuresEnabled).toBe(true)

    const body = JSON.parse(await fs.readFile(hooksPath, 'utf-8')) as {
      hooks: Record<string, Array<{ matcher?: string; hooks: Array<Record<string, unknown>> }>>
    }
    expect(body.hooks.SessionStart).toBeDefined()
    expect(body.hooks.UserPromptSubmit).toBeDefined()
    expect(body.hooks.PreToolUse).toBeDefined()
    expect(body.hooks.Stop).toBeDefined()

    const sessionHandlers = body.hooks.SessionStart.flatMap((b) => b.hooks)
    expect(sessionHandlers.some((h) => h._prjctManaged === true)).toBe(true)
    expect(sessionHandlers[0]?.command).toContain('prjct hook session-start')
    expect(sessionHandlers[0]?.commandWindows).toContain('prjct hook session-start')

    // Edit|Write pre-edit maps with matcher Codex understands for apply_patch.
    const preEdit = body.hooks.PreToolUse.find((b) => b.matcher === 'Edit|Write')
    expect(preEdit).toBeDefined()
    expect(preEdit!.hooks[0]?.command).toContain('pre-edit')
  })

  it('is idempotent on second install', async () => {
    await installCodexHooks({ hooksPath, configPath })
    const r2 = await installCodexHooks({ hooksPath, configPath })
    expect(r2.hooksWritten).toBe(0)
    expect(r2.alreadyPresent).toBe(codexHookSpecs().length)
  })

  it('preserves foreign (non-prjct) handlers under the same event', async () => {
    await fs.writeFile(
      hooksPath,
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'echo foreign-session',
                },
              ],
            },
          ],
        },
      }),
      'utf-8'
    )
    await installCodexHooks({ hooksPath, configPath })
    const body = JSON.parse(await fs.readFile(hooksPath, 'utf-8')) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>
    }
    const cmds = body.hooks.SessionStart.flatMap((b) => b.hooks.map((h) => h.command))
    expect(cmds.some((c) => c.includes('foreign-session'))).toBe(true)
    expect(cmds.some((c) => c.includes('prjct hook session-start'))).toBe(true)
  })

  it('enables [features] hooks = true in config.toml when missing', async () => {
    await fs.writeFile(configPath, 'model = "gpt-5.5"\n', 'utf-8')
    const r = await installCodexHooks({ hooksPath, configPath })
    expect(r.featuresChanged).toBe(true)
    const toml = await fs.readFile(configPath, 'utf-8')
    expect(toml).toContain('hooks = true')
    expect(toml).toContain('model = "gpt-5.5"')
  })

  it('does not clobber an existing hooks = true without markers', async () => {
    await fs.writeFile(configPath, '[features]\nhooks = true\nmodel_reasoning = "high"\n', 'utf-8')
    const r = await ensureCodexHooksFeature(configPath)
    expect(r.changed).toBe(false)
    const toml = await fs.readFile(configPath, 'utf-8')
    expect(toml).toContain('model_reasoning = "high"')
  })
})

describe('uninstallCodexHooks', () => {
  it('removes only prjct-managed handlers', async () => {
    await installCodexHooks({ hooksPath, configPath })
    // Inject foreign after install
    const body = JSON.parse(await fs.readFile(hooksPath, 'utf-8')) as {
      hooks: Record<string, Array<{ hooks: Array<Record<string, unknown>> }>>
    }
    body.hooks.Stop.push({
      hooks: [{ type: 'command', command: 'echo keep-me' }],
    })
    await fs.writeFile(hooksPath, JSON.stringify(body, null, 2), 'utf-8')

    const r = await uninstallCodexHooks(hooksPath)
    expect(r.hooksRemoved).toBeGreaterThan(0)
    const after = JSON.parse(await fs.readFile(hooksPath, 'utf-8')) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>
    }
    const all = Object.values(after.hooks ?? {}).flatMap((blocks) =>
      blocks.flatMap((b) => b.hooks.map((h) => h.command))
    )
    expect(all.some((c) => c.includes('keep-me'))).toBe(true)
    expect(all.every((c) => !c.includes('prjct hook'))).toBe(true)
  })
})

describe('codexHooksStatus', () => {
  it('counts installed managed handlers', async () => {
    expect((await codexHooksStatus(hooksPath)).installed).toBe(0)
    await installCodexHooks({ hooksPath, configPath })
    const st = await codexHooksStatus(hooksPath)
    expect(st.installed).toBe(st.expected)
    expect(st.expected).toBe(codexHookSpecs().length)
  })
})
