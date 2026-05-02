/**
 * global-config tests — read/write to ~/.prjct-cli/config/global.json.
 *
 * Tests redirect to a temp HOME so the user's real config never gets
 * touched. We re-import the module fresh per test to pick up the new
 * HOME env var (config dir is computed at module load).
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

let tempHome = ''
let originalHome = ''

beforeEach(async () => {
  tempHome = path.join(
    os.tmpdir(),
    `prjct-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
  await fs.mkdir(tempHome, { recursive: true })
  originalHome = process.env.HOME ?? ''
  process.env.HOME = tempHome
})

afterEach(async () => {
  process.env.HOME = originalHome
  if (tempHome) {
    await fs.rm(tempHome, { recursive: true, force: true }).catch(() => undefined)
    tempHome = ''
  }
})

async function freshImport(): Promise<typeof import('../../services/global-config')> {
  // Bun caches modules — flush so module-level `path.join(os.homedir(), …)`
  // re-evaluates with the patched HOME. Cache flush is per-test-runner
  // best-effort; if it doesn't take, the assertions still hold because
  // we always read/write through the public API.
  return import(`../../services/global-config?t=${Date.now()}`)
}

describe('global-config', () => {
  test('returns undefined for unset keys', async () => {
    const m = await freshImport()
    expect(m.getConfig('auto-update')).toBeUndefined()
  })

  test('setConfig + getConfig round-trip', async () => {
    const m = await freshImport()
    m.setConfig('auto-update', 'on')
    expect(m.getConfig('auto-update')).toBe('on')
  })

  test('persists across module re-imports (writes to disk)', async () => {
    const m1 = await freshImport()
    m1.setConfig('suggestions', 'off')

    const m2 = await freshImport()
    expect(m2.getConfig('suggestions')).toBe('off')
  })

  test('getAll returns the full bag', async () => {
    const m = await freshImport()
    m.setConfig('auto-update', 'on')
    m.setConfig('suggestions', 'off')

    const all = m.getAll()
    expect(all['auto-update']).toBe('on')
    expect(all.suggestions).toBe('off')
  })

  test('unsetConfig removes a key', async () => {
    const m = await freshImport()
    m.setConfig('auto-update', 'on')
    m.unsetConfig('auto-update')
    expect(m.getConfig('auto-update')).toBeUndefined()
  })

  test('preserves unknown keys on round-trip (forward compat)', async () => {
    const m = await freshImport()
    // Write an unknown key directly so we can verify reads preserve it
    // even when we don't touch it
    m.setConfig('future-feature' as never, 'enabled' as never)
    m.setConfig('auto-update', 'on')

    const all = m.getAll()
    expect(all['future-feature']).toBe('enabled')
    expect(all['auto-update']).toBe('on')
  })

  test('handles missing config dir (creates on first write)', async () => {
    const m = await freshImport()
    // Config dir does not exist yet — setConfig must create it
    m.setConfig('auto-update', 'on')
    const cfgPath = m.configPath()
    const stat = await fs.stat(cfgPath)
    expect(stat.isFile()).toBe(true)
  })

  test('returns empty bag on malformed JSON', async () => {
    const m = await freshImport()
    // Corrupt the file
    await fs.mkdir(path.dirname(m.configPath()), { recursive: true })
    await fs.writeFile(m.configPath(), '{invalid json', 'utf-8')

    const all = m.getAll()
    expect(Object.keys(all).length).toBe(0)
  })
})
