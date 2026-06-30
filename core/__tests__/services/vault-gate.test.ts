/**
 * WS-A: vault generation is OFF by default (prjct = LLM data plane). The gate
 * lives in `generateWiki` — every regen call site funnels through it, so an
 * `off` project never writes `_generated/`. `export` restores generation.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import { projectMemory } from '../../memory/project-memory'
import { effectiveVaultMode } from '../../services/vault-preferences'
import { generateWiki } from '../../services/wiki-generator'
import prjctDb from '../../storage/database'

describe('effectiveVaultMode', () => {
  afterEach(() => {
    process.env.PRJCT_VAULT_MODE = undefined
    if (process.env.PRJCT_VAULT_MODE === 'undefined') delete process.env.PRJCT_VAULT_MODE
  })

  it('defaults to off when unset', () => {
    expect(effectiveVaultMode(null)).toBe('off')
    expect(effectiveVaultMode({ projectId: 'x', dataPath: '' })).toBe('off')
  })

  it('honors config.vault.mode', () => {
    expect(effectiveVaultMode({ projectId: 'x', dataPath: '', vault: { mode: 'export' } })).toBe(
      'export'
    )
    expect(effectiveVaultMode({ projectId: 'x', dataPath: '', vault: { mode: 'off' } })).toBe('off')
  })

  it('falls back to PRJCT_VAULT_MODE env, config wins over env', () => {
    process.env.PRJCT_VAULT_MODE = 'export'
    expect(effectiveVaultMode(null)).toBe('export')
    expect(effectiveVaultMode({ projectId: 'x', dataPath: '', vault: { mode: 'off' } })).toBe('off')
  })
})

describe('generateWiki gate', () => {
  let tmpRoot: string
  let projectRoot: string
  let vaultRoot: string
  const projectId = 'vault-gate-test'
  const spies: Array<ReturnType<typeof spyOn>> = []

  async function writeConfig(mode: 'off' | 'export' | undefined): Promise<void> {
    const vault = mode ? { vault: { mode } } : {}
    await fs.writeFile(
      path.join(projectRoot, '.prjct', 'prjct.config.json'),
      JSON.stringify({ projectId, dataPath: '', ...vault }, null, 2)
    )
    ;(configManager as { clearCache?: () => void }).clearCache?.()
  }

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-vault-gate-'))
    projectRoot = path.join(tmpRoot, 'proj')
    vaultRoot = path.join(tmpRoot, 'vault')
    await fs.mkdir(path.join(projectRoot, '.prjct'), { recursive: true })
    spies.push(spyOn(pathManager, 'getWikiPath').mockImplementation(async () => vaultRoot))
    spies.push(
      spyOn(pathManager, 'getGlobalProjectPath').mockImplementation((pid: string) =>
        path.join(tmpRoot, 'globals', pid)
      )
    )
    spies.push(
      spyOn(pathManager, 'getFilePath').mockImplementation(
        (pid: string, layer: string, filename: string) =>
          path.join(tmpRoot, 'globals', pid, layer, filename)
      )
    )
    await fs.mkdir(path.join(tmpRoot, 'globals', projectId), { recursive: true })
    prjctDb.getDb(projectId)
    // Seed one memory under the default OFF mode so the seed's own regen
    // no-ops — each test then sets the mode it wants and generates fresh.
    await writeConfig('off')
    await projectMemory.remember(projectRoot, {
      type: 'decision',
      content: 'Seed decision for the gate test.',
      projectId,
    })
  })

  afterEach(async () => {
    prjctDb.close()
    for (const s of spies) s.mockRestore()
    spies.length = 0
    ;(configManager as { clearCache?: () => void }).clearCache?.()
    await fs.rm(tmpRoot, { recursive: true, force: true })
  })

  it('mode=off writes nothing and creates no _generated dir', async () => {
    await writeConfig('off')
    const result = await generateWiki(projectRoot, projectId)
    expect(result.filesWritten).toBe(0)
    expect(result.filesSkipped).toBe(0)
    expect(existsSync(path.join(vaultRoot, '_generated'))).toBe(false)
  })

  it('default (unset) is off — no generation', async () => {
    await writeConfig(undefined)
    const result = await generateWiki(projectRoot, projectId)
    expect(result.filesWritten).toBe(0)
    expect(existsSync(path.join(vaultRoot, '_generated'))).toBe(false)
  })

  it('mode=export generates the vault', async () => {
    await writeConfig('export')
    const result = await generateWiki(projectRoot, projectId)
    expect(result.filesWritten).toBeGreaterThan(0)
    expect(existsSync(path.join(vaultRoot, '_generated'))).toBe(true)
  })
})
