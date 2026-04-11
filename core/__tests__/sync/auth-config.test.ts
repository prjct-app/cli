import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import authConfig from '../../sync/auth-config'

let tmpDir: string
let tmpPath: string
const originalConfigPath = (authConfig as unknown as { configPath: string }).configPath

async function setConfigPath(p: string) {
  ;(authConfig as unknown as { configPath: string }).configPath = p
  authConfig.clearCache()
}

describe('AuthConfig', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-auth-test-'))
    tmpPath = path.join(tmpDir, 'auth.json')
    await setConfigPath(tmpPath)
  })

  afterEach(async () => {
    await setConfigPath(originalConfigPath)
    try {
      await fs.rm(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('read', () => {
    it('returns defaults when file does not exist', async () => {
      const cfg = await authConfig.read()
      expect(cfg.apiKey).toBeNull()
      expect(cfg.apiUrl).toBe('https://api.prjct.app')
      expect(cfg.userId).toBeNull()
      expect(cfg.email).toBeNull()
      expect(cfg.lastAuth).toBeNull()
    })

    it('caches reads across calls', async () => {
      await authConfig.write({ apiKey: 'cached-key' })
      const a = await authConfig.read()
      // Manually corrupt the underlying file; cached read should not see it.
      await fs.writeFile(tmpPath, '{"apiKey":"disk-only"}')
      const b = await authConfig.read()
      expect(b.apiKey).toBe(a.apiKey)
      expect(b.apiKey).toBe('cached-key')
    })
  })

  describe('write + saveAuth', () => {
    it('saves api key, user id, and email', async () => {
      await authConfig.saveAuth('sk_test_123', 'user-1', 'user@example.com')
      const cfg = await authConfig.read()
      expect(cfg.apiKey).toBe('sk_test_123')
      expect(cfg.userId).toBe('user-1')
      expect(cfg.email).toBe('user@example.com')
      expect(cfg.lastAuth).not.toBeNull()
    })

    it('writes file with 0600 permissions', async () => {
      await authConfig.saveAuth('sk_test_123', 'u', 'e@x')
      const stat = await fs.stat(tmpPath)
      // Mask off the file type bits, keep permission bits.
      expect(stat.mode & 0o777).toBe(0o600)
    })

    it('merges partial updates with existing config', async () => {
      await authConfig.saveAuth('k1', 'u1', 'e1@x')
      await authConfig.write({ apiUrl: 'https://staging.prjct.app' })
      const cfg = await authConfig.read()
      expect(cfg.apiKey).toBe('k1')
      expect(cfg.userId).toBe('u1')
      expect(cfg.apiUrl).toBe('https://staging.prjct.app')
    })
  })

  describe('hasAuth', () => {
    it('returns false when no api key', async () => {
      expect(await authConfig.hasAuth()).toBe(false)
    })

    it('returns true after saveAuth', async () => {
      await authConfig.saveAuth('sk_test_123', 'u', 'e@x')
      expect(await authConfig.hasAuth()).toBe(true)
    })

    it('returns false after clearAuth', async () => {
      await authConfig.saveAuth('sk_test_123', 'u', 'e@x')
      await authConfig.clearAuth()
      expect(await authConfig.hasAuth()).toBe(false)
    })
  })

  describe('getApiKey / getApiUrl', () => {
    it('returns null api key when unauthenticated', async () => {
      expect(await authConfig.getApiKey()).toBeNull()
    })

    it('returns the saved api key', async () => {
      await authConfig.saveAuth('sk_abc', 'u', 'e@x')
      expect(await authConfig.getApiKey()).toBe('sk_abc')
    })

    it('returns default api url when unset', async () => {
      expect(await authConfig.getApiUrl()).toBe('https://api.prjct.app')
    })
  })

  describe('getStatus', () => {
    it('reports unauthenticated when no key', async () => {
      const status = await authConfig.getStatus()
      expect(status.authenticated).toBe(false)
      expect(status.email).toBeNull()
      expect(status.apiKeyPrefix).toBeNull()
    })

    it('reports authenticated with truncated key prefix', async () => {
      await authConfig.saveAuth('sk_test_12345678901234', 'u', 'jane@example.com')
      const status = await authConfig.getStatus()
      expect(status.authenticated).toBe(true)
      expect(status.email).toBe('jane@example.com')
      expect(status.apiKeyPrefix).toBe('sk_test_1234...')
    })
  })

  describe('clearAuth', () => {
    it('resets cached config and writes defaults to disk', async () => {
      await authConfig.saveAuth('sk_test_123', 'u', 'e@x')
      await authConfig.clearAuth()
      const cfg = await authConfig.read()
      expect(cfg.apiKey).toBeNull()
      expect(cfg.userId).toBeNull()
    })
  })
})
