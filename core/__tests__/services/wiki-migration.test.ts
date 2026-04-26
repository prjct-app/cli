/**
 * Tests for the pre-2.2.0 → 2.2.0 vault-location migration.
 *
 * Uses PRJCT_CLI_HOME override for globalBaseDir, and monkey-patches
 * pathManager.getWikiPath to point into tmp so tests don't clobber the
 * user's real ~/Documents/prjct/.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import { migrateWikiLocationIfNeeded } from '../../services/wiki-migration'

let tmpRoot: string
let projectRoot: string
let fakeNewVaultRoot: string
let wikiPathSpy: ReturnType<typeof spyOn> | null = null

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-wiki-mig-'))
  projectRoot = path.join(tmpRoot, 'myproj')
  fakeNewVaultRoot = path.join(tmpRoot, 'home', 'Documents', 'prjct')
  await fs.mkdir(projectRoot, { recursive: true })
  await fs.mkdir(path.join(projectRoot, '.prjct'), { recursive: true })
  // seed a minimal project config
  await fs.writeFile(
    path.join(projectRoot, '.prjct', 'prjct.config.json'),
    JSON.stringify({ projectId: 'test-pid', dataPath: '' }, null, 2)
  )

  // redirect the default ~/Documents/prjct/<slug>/ into our tmp sandbox
  wikiPathSpy = spyOn(pathManager, 'getWikiPath').mockImplementation(
    async (_projectPath: string, override?: string) => {
      if (override && override.trim().length > 0) {
        // minimal override handling that mirrors the real resolver
        const trimmed = override.trim()
        if (trimmed.startsWith('~/')) return path.join(os.homedir(), trimmed.slice(2))
        if (path.isAbsolute(trimmed)) return trimmed
        return path.resolve(_projectPath, trimmed)
      }
      return path.join(fakeNewVaultRoot, 'myproj')
    }
  )
})

afterEach(async () => {
  // Restore the spy so other test files (run in arbitrary order) see
  // the real `pathManager.getWikiPath`. Without this, the mock can
  // bleed into `path-manager-wiki.test.ts` on runners where tests are
  // scheduled in a different order than on darwin.
  wikiPathSpy?.mockRestore()
  wikiPathSpy = null
  await fs.rm(tmpRoot, { recursive: true, force: true })
  ;(configManager as { clearCache?: () => void }).clearCache?.()
})

async function seedLegacyWiki(files: Record<string, string>): Promise<void> {
  const legacy = path.join(projectRoot, '.prjct', 'wiki')
  await fs.mkdir(legacy, { recursive: true })
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(legacy, rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, content, 'utf-8')
  }
}

async function readOrNull(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf-8')
  } catch {
    return null
  }
}

describe('migrateWikiLocationIfNeeded', () => {
  it('is a no-op when there is no legacy wiki', async () => {
    const result = await migrateWikiLocationIfNeeded(projectRoot)
    expect(result.moved).toBe(false)
    expect(result.reason).toBe('no-legacy')
  })

  it('moves legacy content to the new default location', async () => {
    await seedLegacyWiki({
      'README.md': '# vault',
      '_generated/index.md': '# index',
      '_generated/memory/decision.md': 'old decision',
    })

    const result = await migrateWikiLocationIfNeeded(projectRoot)

    expect(result.moved).toBe(true)
    expect(result.filesMoved).toBe(3)
    expect(result.from).toBe(path.join(projectRoot, '.prjct', 'wiki'))
    expect(result.to).toBe(path.join(fakeNewVaultRoot, 'myproj'))

    // new location has the content
    expect(await readOrNull(path.join(fakeNewVaultRoot, 'myproj', 'README.md'))).toBe('# vault')
    expect(
      await readOrNull(path.join(fakeNewVaultRoot, 'myproj', '_generated/memory/decision.md'))
    ).toBe('old decision')

    // legacy path removed
    const legacyExists = await fs
      .stat(path.join(projectRoot, '.prjct', 'wiki'))
      .then(() => true)
      .catch(() => false)
    expect(legacyExists).toBe(false)
  })

  it('is idempotent — second call is a no-op', async () => {
    await seedLegacyWiki({ 'x.md': 'hi' })
    const first = await migrateWikiLocationIfNeeded(projectRoot)
    expect(first.moved).toBe(true)

    const second = await migrateWikiLocationIfNeeded(projectRoot)
    expect(second.moved).toBe(false)
    expect(second.reason).toBe('no-legacy')
  })

  it('respects a user-set vaultPath override and refuses to migrate', async () => {
    await seedLegacyWiki({ 'x.md': 'hi' })
    await fs.writeFile(
      path.join(projectRoot, '.prjct', 'prjct.config.json'),
      JSON.stringify({ projectId: 'test-pid', dataPath: '', vaultPath: '.prjct/wiki' }, null, 2)
    )
    ;(configManager as { clearCache?: () => void }).clearCache?.()

    const result = await migrateWikiLocationIfNeeded(projectRoot)
    expect(result.moved).toBe(false)
    expect(result.reason).toBe('user-override')

    // legacy path untouched
    expect(await readOrNull(path.join(projectRoot, '.prjct', 'wiki', 'x.md'))).toBe('hi')
  })

  it('refuses to overwrite when the new location already has content', async () => {
    await seedLegacyWiki({ 'x.md': 'legacy body' })
    await fs.mkdir(path.join(fakeNewVaultRoot, 'myproj'), { recursive: true })
    await fs.writeFile(path.join(fakeNewVaultRoot, 'myproj', 'existing.md'), 'NEW')

    const result = await migrateWikiLocationIfNeeded(projectRoot)
    expect(result.moved).toBe(false)
    expect(result.reason).toBe('conflict')

    // both locations unchanged
    expect(await readOrNull(path.join(projectRoot, '.prjct', 'wiki', 'x.md'))).toBe('legacy body')
    expect(await readOrNull(path.join(fakeNewVaultRoot, 'myproj', 'existing.md'))).toBe('NEW')
  })

  it('appends a gitignore entry for the legacy path when migrating', async () => {
    // pretend the repo is a git repo so .gitignore creation is permitted
    await fs.mkdir(path.join(projectRoot, '.git'), { recursive: true })
    await seedLegacyWiki({ 'x.md': 'hi' })

    await migrateWikiLocationIfNeeded(projectRoot)

    const gi = await readOrNull(path.join(projectRoot, '.gitignore'))
    expect(gi).not.toBeNull()
    expect(gi).toContain('.prjct/wiki/')
    expect(gi).toContain('prjct: legacy wiki')
  })

  it('does NOT add a gitignore entry in a non-git project', async () => {
    await seedLegacyWiki({ 'x.md': 'hi' })

    await migrateWikiLocationIfNeeded(projectRoot)

    const gi = await readOrNull(path.join(projectRoot, '.gitignore'))
    expect(gi).toBeNull()
  })

  it('does not duplicate the gitignore entry on repeat migrations', async () => {
    await fs.mkdir(path.join(projectRoot, '.git'), { recursive: true })
    await seedLegacyWiki({ 'x.md': 'hi' })
    await migrateWikiLocationIfNeeded(projectRoot)

    // re-seed and migrate again
    await seedLegacyWiki({ 'y.md': 'ho' })
    // first migration moved the legacy, so new content must go through
    // migration of its own — reset new vault to simulate a conflict-free case
    await fs.rm(path.join(fakeNewVaultRoot, 'myproj'), { recursive: true, force: true })
    await migrateWikiLocationIfNeeded(projectRoot)

    const gi = await readOrNull(path.join(projectRoot, '.gitignore'))
    expect(gi).not.toBeNull()
    const matches = gi!.match(/\.prjct\/wiki\//g) ?? []
    expect(matches.length).toBe(1)
  })
})
