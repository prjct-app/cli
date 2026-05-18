/**
 * WS4+WS5 — `prjct update` install consolidation + one-command notify.
 *
 *  - the new-version banner must point at `prjct upgrade` (the ONE command
 *    that updates every install AND consolidates), never the hardcoded
 *    `npm install -g` that creates the multi-install footgun;
 *  - `--no-cleanup` must deterministically skip consolidation;
 *  - `planCleanup()` is defensive — it never throws and never proposes
 *    removing without a provable winner.
 */

import { afterEach, beforeEach, describe, expect, it, setDefaultTimeout } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { consolidateInstalls, planCleanup } from '../../commands/update/cleanup-installs'
import pathManager from '../../infrastructure/path-manager'
import { getUpdateNotificationSync } from '../../infrastructure/update-checker'

// planCleanup() shells out to real PM detection (brew list, npm/pnpm/yarn
// root -g) — slower than bun's 5s default; give it headroom.
setDefaultTimeout(60_000)

describe('WS5 — new-version banner is one-command', () => {
  let tmp: string
  const origBase = pathManager.getGlobalBasePath()

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-banner-'))
    pathManager.setGlobalBaseDir(tmp)
    await fs.mkdir(path.join(tmp, 'config'), { recursive: true })
    await fs.writeFile(
      path.join(tmp, 'config', 'update-cache.json'),
      JSON.stringify({ lastCheck: Date.now(), latestVersion: '99.0.0' })
    )
  })
  afterEach(async () => {
    pathManager.setGlobalBaseDir(origBase)
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
  })

  it('recommends `prjct upgrade`, never `npm install -g`', () => {
    const banner = getUpdateNotificationSync('1.0.0')
    expect(banner).not.toBeNull()
    expect(banner).toContain('prjct upgrade')
    expect(banner).not.toContain('npm install -g')
    expect(banner).toContain('99.0.0') // the cached latest
  })
})

describe('WS4 — consolidateInstalls', () => {
  it('--no-cleanup (off) deterministically skips, no errors', async () => {
    const r = await consolidateInstalls('off', false, false)
    expect(r.errors).toEqual([])
    expect(r.details.join(' ')).toContain('--no-cleanup')
  })

  it('dry-run never removes — only reports intent', async () => {
    // dry-run must not shell out to any uninstall; details only.
    const r = await consolidateInstalls('auto', true, false)
    expect(r.errors).toEqual([])
    for (const d of r.details) expect(d).not.toContain('Removed redundant')
  })

  it('planCleanup() is defensive: never throws, well-formed shape', () => {
    const plan = planCleanup()
    expect(Array.isArray(plan.removable)).toBe(true)
    expect(Array.isArray(plan.skipped)).toBe(true)
    // Safety invariant: nothing is ever removable without a winner.
    if (plan.winner === null) expect(plan.removable).toEqual([])
  })
})
