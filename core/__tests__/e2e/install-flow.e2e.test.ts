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
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { makeSandbox, REPO_ROOT, type Sandbox } from './_harness'

setDefaultTimeout(120_000)

const REPO_VERSION = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'))
  .version as string

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
