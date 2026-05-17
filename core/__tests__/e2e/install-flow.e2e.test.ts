/**
 * E2E: the README "Install / upgrade — one paste" promise, hermetically.
 *
 * The real prompt is: detect package manager → global install → `prjct setup`
 * → `prjct sync` (if git repo) → verify `prjct -v`. A global npm/bun install
 * can't run hermetically, so we exercise the *post-install* contract that the
 * prompt promises against the repo build in an isolated home:
 *
 *   prjct -v   →  prjct init  →  prjct setup  →  prjct sync  →  prjct doctor
 *
 * If any of these is broken, the onboarding promise is broken.
 */

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { makeSandbox, REPO_ROOT, type Sandbox } from './_harness'

setDefaultTimeout(120_000)

const REPO_VERSION = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'))
  .version as string

describe('e2e: PRJCT_CLI_HOME is honored when it differs from HOME (regression)', () => {
  // Regression for the os.homedir() footgun: the "not configured" guard
  // resolved its config path via os.homedir() instead of pathManager, so
  // with PRJCT_CLI_HOME ≠ HOME, `setup` wrote installed-editors.json under
  // PRJCT_CLI_HOME but the guard looked under HOME → every command misfired
  // as "not configured". (Hidden whenever HOME == PRJCT_CLI_HOME.)
  let sb: Sandbox

  beforeAll(async () => {
    sb = await makeSandbox({ splitCliHome: true })
    expect((await sb.cli(['init'], { timeoutMs: 90_000 })).code).toBe(0)
    expect((await sb.cli(['setup'], { timeoutMs: 90_000 })).code).toBe(0)
  })
  afterAll(async () => {
    await sb.cleanup()
  })

  test('setup writes installed-editors.json under PRJCT_CLI_HOME, not HOME', () => {
    expect(existsSync(path.join(sb.home, 'config', 'installed-editors.json'))).toBe(true)
  })

  test('a normal command is NOT misreported as "not configured"', async () => {
    const r = await sb.cli(['task', 'split-home smoke', '--md'])
    expect(r.code).toBe(0)
    expect((r.stdout + r.stderr).toLowerCase()).not.toContain('not configured')
  })
})

describe('e2e: install/upgrade onboarding contract', () => {
  let sb: Sandbox

  beforeAll(async () => {
    sb = await makeSandbox()
  })
  afterAll(async () => {
    await sb.cleanup()
  })

  test('`prjct -v` reports the package.json version (not a stale global)', async () => {
    const r = await sb.cli(['-v'])
    expect(r.code).toBe(0)
    expect(r.stdout + r.stderr).toContain(REPO_VERSION)
  })

  test('`prjct init` then `prjct setup` reach a configured state', async () => {
    const init = await sb.cli(['init'], { timeoutMs: 90_000 })
    expect(init.code).toBe(0)

    const setup = await sb.cli(['setup'], { timeoutMs: 90_000 })
    expect(setup.code).toBe(0)

    // Configured ⇒ a normal command no longer hits the "not configured" gate.
    const task = await sb.cli(['task', 'post-setup smoke', '--md'])
    expect(task.code).toBe(0)
    expect((task.stdout + task.stderr).toLowerCase()).not.toContain('not configured')
  })

  test('`prjct sync` works inside a git repo (the prompt runs it post-setup)', async () => {
    const r = await sb.cli(['sync', '--md', '--yes'], { timeoutMs: 120_000 })
    expect(r.code).toBe(0)
    expect(r.stdout.toLowerCase()).toMatch(/sync|indexed|analysis/)
  })

  test('`prjct doctor` reports health without crashing', async () => {
    const r = await sb.cli(['doctor'], { timeoutMs: 60_000 })
    expect([0, 1]).toContain(r.code) // may warn, must not crash
    expect(r.stdout + r.stderr).not.toMatch(/Cannot read|TypeError|unhandled|is not a function/i)
  })
})
