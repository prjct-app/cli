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

  // Redirect the resolver via the cross-platform env override so mac
  // runs don't write into the user's real Obsidian config at
  // ~/Library/Application Support/obsidian/.
  fakeObsidianDir = path.join(tmpRoot, 'obsidian')
  fakeObsidianJson = path.join(fakeObsidianDir, 'obsidian.json')
  process.env.PRJCT_OBSIDIAN_CONFIG_DIR = fakeObsidianDir
})

afterEach(async () => {
  delete process.env.PRJCT_OBSIDIAN_CONFIG_DIR
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

describe('ensureObsidianVault — registration (sandboxed via env override)', () => {
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
  it('returns the env-override path when PRJCT_OBSIDIAN_CONFIG_DIR is set and exists', async () => {
    await fs.mkdir(fakeObsidianDir, { recursive: true })
    expect(resolveObsidianConfigPath()).toBe(fakeObsidianJson)
  })

  it('returns null when the configured dir does not exist', () => {
    // beforeEach set PRJCT_OBSIDIAN_CONFIG_DIR but didn't create the dir
    expect(resolveObsidianConfigPath()).toBeNull()
  })
})
