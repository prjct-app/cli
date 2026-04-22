/**
 * Tests for the Obsidian auto-register / bootstrap behaviour (2.2.1).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ensureObsidianVault, resolveObsidianConfigPath } from '../../services/obsidian-vault'

let tmpRoot: string
let vaultPath: string
let fakeObsidianDir: string
let fakeObsidianJson: string

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-obsidian-'))
  vaultPath = path.join(tmpRoot, 'my-vault')
  await fs.mkdir(vaultPath, { recursive: true })

  fakeObsidianDir = path.join(tmpRoot, 'obsidian-config')
  fakeObsidianJson = path.join(fakeObsidianDir, 'obsidian.json')

  // Point the resolver at our sandbox by setting XDG_CONFIG_HOME — only
  // matters on linux; mac/win paths are hardcoded.
  process.env.XDG_CONFIG_HOME = tmpRoot
})

afterEach(async () => {
  delete process.env.XDG_CONFIG_HOME
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

async function readOrNull(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf-8')
  } catch {
    return null
  }
}

describe('ensureObsidianVault — bootstrap', () => {
  it('creates .obsidian/app.json if missing', async () => {
    await ensureObsidianVault(vaultPath)
    const body = await readOrNull(path.join(vaultPath, '.obsidian', 'app.json'))
    expect(body).not.toBeNull()
    expect(JSON.parse(body!)).toEqual({})
  })

  it('leaves existing .obsidian/app.json untouched', async () => {
    const dotObsidian = path.join(vaultPath, '.obsidian')
    await fs.mkdir(dotObsidian, { recursive: true })
    await fs.writeFile(path.join(dotObsidian, 'app.json'), '{"readingMode": "source"}')

    const result = await ensureObsidianVault(vaultPath)
    expect(result.bootstrapped).toBe(false)

    const body = await readOrNull(path.join(dotObsidian, 'app.json'))
    expect(body).toBe('{"readingMode": "source"}')
  })

  it('exposes the vault name from the folder basename', async () => {
    const result = await ensureObsidianVault(vaultPath)
    expect(result.vaultName).toBe('my-vault')
    expect(result.openUrl).toBe('obsidian://open?vault=my-vault')
  })

  it('url-encodes vault names with special chars', async () => {
    const funkyVault = path.join(tmpRoot, 'my app!')
    await fs.mkdir(funkyVault, { recursive: true })
    const result = await ensureObsidianVault(funkyVault)
    expect(result.openUrl).toBe('obsidian://open?vault=my%20app!')
  })
})

// The config-file registration paths rely on platform detection. We
// exercise them on Linux where XDG_CONFIG_HOME gives a clean sandbox.
const isLinux = process.platform === 'linux'
const describeLinux = isLinux ? describe : describe.skip

describeLinux('ensureObsidianVault — registration (linux sandbox)', () => {
  beforeEach(async () => {
    // pre-create Obsidian config dir so resolver returns a valid path
    await fs.mkdir(fakeObsidianDir, { recursive: true })
  })

  it('creates a fresh obsidian.json when none exists', async () => {
    const result = await ensureObsidianVault(vaultPath)
    expect(result.obsidianConfigFound).toBe(true)
    expect(result.registered).toBe(true)

    const body = await readOrNull(fakeObsidianJson)
    const config = JSON.parse(body!)
    const registered = Object.values(config.vaults) as Array<{ path: string }>
    expect(registered.length).toBe(1)
    expect(registered[0].path).toBe(path.resolve(vaultPath))
  })

  it('appends to an existing obsidian.json without clobbering prior vaults', async () => {
    await fs.writeFile(
      fakeObsidianJson,
      JSON.stringify({
        vaults: { deadbeef: { path: '/some/other/vault', ts: 1 } },
        cli: true,
      })
    )

    await ensureObsidianVault(vaultPath)

    const config = JSON.parse((await readOrNull(fakeObsidianJson))!)
    const paths = (Object.values(config.vaults) as Array<{ path: string }>).map((v) => v.path)
    expect(paths).toContain('/some/other/vault')
    expect(paths).toContain(path.resolve(vaultPath))
    expect(config.cli).toBe(true) // non-vault keys preserved
  })

  it('is idempotent — re-registering the same path is a no-op', async () => {
    await ensureObsidianVault(vaultPath)
    const first = await readOrNull(fakeObsidianJson)

    const second = await ensureObsidianVault(vaultPath)
    expect(second.alreadyRegistered).toBe(true)
    expect(second.registered).toBe(false)

    const after = await readOrNull(fakeObsidianJson)
    expect(after).toBe(first)
  })

  it('reports obsidianConfigFound=false when Obsidian is not installed', async () => {
    await fs.rm(fakeObsidianDir, { recursive: true, force: true })
    const result = await ensureObsidianVault(vaultPath)
    expect(result.obsidianConfigFound).toBe(false)
    expect(result.registered).toBe(false)
    // bootstrap still happens — it only touches the vault
    expect(result.bootstrapped).toBe(true)
  })
})

describe('resolveObsidianConfigPath', () => {
  it('returns a non-null path when the config dir exists', async () => {
    if (isLinux) {
      await fs.mkdir(fakeObsidianDir, { recursive: true })
      expect(resolveObsidianConfigPath()).toBe(fakeObsidianJson)
    } else {
      // on darwin/win we can only check whether existing returns non-null
      // without mutating real system dirs
      const result = resolveObsidianConfigPath()
      if (result !== null) {
        expect(result.endsWith('obsidian.json')).toBe(true)
      }
    }
  })
})
