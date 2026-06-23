/**
 * Tests for `pathManager.getWikiPath()` — the 2.2.0 vault resolver.
 *
 * NOTE: the global test preload (`_setup/reset-singletons.ts`) sets
 * `PRJCT_VAULT_ROOT` to a throwaway temp dir so no test ever writes into the
 * real `~/Documents/prjct/`. The slug-logic tests below therefore assert
 * against `getVaultRoot()` (which honors that env) rather than a hardcoded
 * `~/Documents/prjct`. A dedicated block save/restores the env to pin the
 * literal default and the override semantics.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { getVaultRoot } from '../../infrastructure/path-manager/wiki-paths'
import { resolveUserHome } from '../../infrastructure/user-home'
import {
  getDefaultVaultRoot,
  setConfiguredVaultRoot,
  unsetConfiguredVaultRoot,
} from '../../services/vault-preferences'

let tempCliHome = ''
let savedCliHome: string | undefined

beforeEach(() => {
  savedCliHome = process.env.PRJCT_CLI_HOME
  tempCliHome = fs.mkdtempSync(path.join(os.tmpdir(), 'prjct-wiki-path-config-'))
  process.env.PRJCT_CLI_HOME = tempCliHome
})

afterEach(() => {
  unsetConfiguredVaultRoot()
  if (savedCliHome === undefined) delete process.env.PRJCT_CLI_HOME
  else process.env.PRJCT_CLI_HOME = savedCliHome
  if (tempCliHome) fs.rmSync(tempCliHome, { recursive: true, force: true })
  tempCliHome = ''
})

describe('getWikiPath — default location', () => {
  it('defaults to <vaultRoot>/<basename-slug>', async () => {
    const result = await pathManager.getWikiPath('/Users/foo/code/my-app')
    expect(result).toBe(path.join(getVaultRoot(), 'my-app'))
  })

  it('lowercases and slugifies non-alphanumeric chars in the basename', async () => {
    const result = await pathManager.getWikiPath('/Users/foo/code/My App!')
    expect(result).toBe(path.join(getVaultRoot(), 'my-app'))
  })

  it('falls back to "project" when the basename has no alphanumerics', async () => {
    const result = await pathManager.getWikiPath('/Users/foo/___')
    expect(result).toBe(path.join(getVaultRoot(), 'project'))
  })

  it('strips leading/trailing dashes after slugification', async () => {
    const result = await pathManager.getWikiPath('/Users/foo/-awesome-')
    expect(result).toBe(path.join(getVaultRoot(), 'awesome'))
  })
})

describe('getWikiPath — user override', () => {
  it('uses an absolute override verbatim', async () => {
    const override = '/tmp/custom/vault'
    expect(await pathManager.getWikiPath('/any/project', override)).toBe(override)
  })

  it('expands ~ in an override', async () => {
    const result = await pathManager.getWikiPath('/any/project', '~/my-vault')
    expect(result).toBe(path.join(resolveUserHome(), 'my-vault'))
  })

  it('resolves relative overrides against the project root (keeps in-repo option)', async () => {
    const result = await pathManager.getWikiPath('/Users/foo/code/my-app', './docs/wiki')
    expect(result).toBe('/Users/foo/code/my-app/docs/wiki')
  })

  it('treats ".prjct/wiki" as a project-relative rollback path', async () => {
    const result = await pathManager.getWikiPath('/Users/foo/code/my-app', '.prjct/wiki')
    expect(result).toBe('/Users/foo/code/my-app/.prjct/wiki')
  })

  it('ignores whitespace-only override and falls back to default', async () => {
    const result = await pathManager.getWikiPath('/Users/foo/code/my-app', '   ')
    expect(result).toBe(path.join(getVaultRoot(), 'my-app'))
  })
})

describe('getVaultRoot — PRJCT_VAULT_ROOT override', () => {
  it('defaults to the platform Documents/prjct directory when the env is unset', () => {
    const saved = process.env.PRJCT_VAULT_ROOT
    try {
      delete process.env.PRJCT_VAULT_ROOT
      unsetConfiguredVaultRoot()
      expect(getVaultRoot()).toBe(path.join(resolveUserHome(), 'Documents', 'prjct'))
    } finally {
      if (saved === undefined) delete process.env.PRJCT_VAULT_ROOT
      else process.env.PRJCT_VAULT_ROOT = saved
    }
  })

  it('honors PRJCT_VAULT_ROOT (resolved to absolute) for both resolvers', async () => {
    const saved = process.env.PRJCT_VAULT_ROOT
    try {
      process.env.PRJCT_VAULT_ROOT = '/tmp/sandbox-vault'
      expect(getVaultRoot()).toBe('/tmp/sandbox-vault')
      expect(await pathManager.getWikiPath('/Users/foo/code/my-app')).toBe(
        '/tmp/sandbox-vault/my-app'
      )
      expect(
        pathManager.getWikiPathWithProjectHash('/Users/foo/code/foo', 'bc401c41-c8b9-436a')
      ).toBe('/tmp/sandbox-vault/foo-bc401c41')
    } finally {
      if (saved === undefined) delete process.env.PRJCT_VAULT_ROOT
      else process.env.PRJCT_VAULT_ROOT = saved
    }
  })

  it('uses the setup-configured vault root when no env override is present', async () => {
    const savedEnv = process.env.PRJCT_VAULT_ROOT
    try {
      delete process.env.PRJCT_VAULT_ROOT
      const configured = setConfiguredVaultRoot('/tmp/setup-vault-root')
      expect(getVaultRoot()).toBe(configured)
      expect(await pathManager.getWikiPath('/Users/foo/code/my-app')).toBe(
        path.join(configured, 'my-app')
      )
    } finally {
      unsetConfiguredVaultRoot()
      if (savedEnv === undefined) delete process.env.PRJCT_VAULT_ROOT
      else process.env.PRJCT_VAULT_ROOT = savedEnv
    }
  })

  it('keeps PRJCT_VAULT_ROOT above the setup-configured root for automation', () => {
    const savedEnv = process.env.PRJCT_VAULT_ROOT
    try {
      setConfiguredVaultRoot('/tmp/setup-vault-root')
      process.env.PRJCT_VAULT_ROOT = '/tmp/env-vault-root'
      expect(getVaultRoot()).toBe('/tmp/env-vault-root')
    } finally {
      unsetConfiguredVaultRoot()
      if (savedEnv === undefined) delete process.env.PRJCT_VAULT_ROOT
      else process.env.PRJCT_VAULT_ROOT = savedEnv
    }
  })

  it('uses XDG Documents on Linux when available', () => {
    if (process.platform !== 'linux') return
    const savedEnv = process.env.PRJCT_VAULT_ROOT
    const savedXdg = process.env.XDG_CONFIG_HOME
    const savedHome = process.env.HOME
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prjct-xdg-docs-'))
    try {
      delete process.env.PRJCT_VAULT_ROOT
      unsetConfiguredVaultRoot()
      process.env.HOME = path.join(tmp, 'home')
      process.env.XDG_CONFIG_HOME = path.join(tmp, 'config')
      fs.mkdirSync(process.env.XDG_CONFIG_HOME, { recursive: true })
      fs.writeFileSync(
        path.join(process.env.XDG_CONFIG_HOME, 'user-dirs.dirs'),
        'XDG_DOCUMENTS_DIR="$HOME/My Documents"\n',
        'utf-8'
      )
      expect(getDefaultVaultRoot()).toBe(path.join(process.env.HOME, 'My Documents', 'prjct'))
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
      if (savedEnv === undefined) delete process.env.PRJCT_VAULT_ROOT
      else process.env.PRJCT_VAULT_ROOT = savedEnv
      if (savedXdg === undefined) delete process.env.XDG_CONFIG_HOME
      else process.env.XDG_CONFIG_HOME = savedXdg
      if (savedHome === undefined) delete process.env.HOME
      else process.env.HOME = savedHome
    }
  })
})

describe('getWikiPathWithProjectHash — collision disambiguation', () => {
  it('appends first 8 chars of the projectId (stripped of dashes)', () => {
    const result = pathManager.getWikiPathWithProjectHash(
      '/Users/foo/code/foo',
      'bc401c41-c8b9-436a-ac78-c91cac82ab4f'
    )
    expect(result).toBe(path.join(getVaultRoot(), 'foo-bc401c41'))
  })
})

describe('getLegacyWikiPath', () => {
  it('returns the pre-2.2.0 in-repo vault path', () => {
    expect(pathManager.getLegacyWikiPath('/Users/foo/code/my-app')).toBe(
      '/Users/foo/code/my-app/.prjct/wiki'
    )
  })
})
