/**
 * `prjct cloud` control surface — config gating and the local-first default.
 *
 * Verifies the user-facing contract without touching the network:
 *  - an unlinked project is local-only; sync/pull are gated off
 *  - link flips `config.cloud.enabled` on (persisted)
 *  - backend link status is surfaced without local entitlement checks
 *  - unlink / pause / resume mutate config as expected
 *  - status reports the right state
 *
 * Auth is stubbed (the gate that matters here is `config.cloud.enabled`,
 * checked before any network call).
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { CloudCommands } from '../../commands/cloud'
import configManager from '../../infrastructure/config-manager'
import authConfig from '../../sync/auth-config'
import syncClient from '../../sync/sync-client'
import syncManager from '../../sync/sync-manager'

let tempDir: string
let originalProjectsDir: string | undefined
let cloud: CloudCommands
const origSync = syncManager.sync.bind(syncManager)
const origPull = syncManager.pull.bind(syncManager)
const origLinkProject = syncClient.linkProject.bind(syncClient)
const origRead = authConfig.read.bind(authConfig)

describe('prjct cloud command', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-cloud-cmd-'))
    originalProjectsDir = process.env.PRJCT_PROJECTS_DIR
    process.env.PRJCT_PROJECTS_DIR = path.join(tempDir, 'projects')
    await configManager.writeConfig(tempDir, {
      projectId: `cloudcmd-${Date.now()}`,
      dataPath: path.join(tempDir, 'projects'),
    })
    cloud = new CloudCommands()
    // Pretend we're authenticated — the local-only gate is independent of auth.
    authConfig.read = mock(async () => ({ apiKey: 'pk_live_test', deviceId: 'd1' }) as never)
    // Keep the suite offline: link/sync never touch the network.
    syncManager.sync = mock(async () => ({
      success: true,
      skipped: false,
      pushed: { count: 0, syncedAt: '' },
      pulled: { count: 0, syncedAt: '' },
    })) as never
    syncManager.pull = mock(async () => ({
      success: true,
      skipped: false,
      count: 0,
      applied: 0,
      syncedAt: '',
    })) as never
    syncClient.linkProject = mock(async (projectId: string) => ({
      projectId,
      syncStatus: 'active',
      billingState: 'active',
      billingInterval: 'monthly',
      billingUrl: 'https://cli.prjct.app/billing',
      message: 'Cloud sync is active for this repo.',
    })) as never
  })

  afterEach(async () => {
    if (originalProjectsDir === undefined) delete process.env.PRJCT_PROJECTS_DIR
    else process.env.PRJCT_PROJECTS_DIR = originalProjectsDir
    authConfig.read = origRead
    authConfig.clearCache()
    syncManager.sync = origSync
    syncManager.pull = origPull
    syncClient.linkProject = origLinkProject
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('sync on an unlinked project is gated off (local-first default)', async () => {
    const res = await cloud.cloud('sync', tempDir, { md: true })
    expect(res.success).toBe(false)
    expect(res.error).toContain('not linked')
  })

  test('pull on an unlinked project is gated off', async () => {
    const res = await cloud.cloud('pull', tempDir, { md: true })
    expect(res.success).toBe(false)
    expect(res.error).toContain('not linked')
  })

  test('link flips config.cloud.enabled on and persists it', async () => {
    // link triggers an initial sync; with no pending events + stubbed auth it
    // resolves without network. We only assert the config side-effect.
    await cloud.cloud('link', tempDir, { md: true }).catch(() => undefined)
    const config = await configManager.readConfig(tempDir)
    expect(config?.cloud?.enabled).toBe(true)
    expect(config?.cloud?.linkedAt).toBeTruthy()
  })

  test('link surfaces backend payment-required state without local entitlement logic', async () => {
    syncClient.linkProject = mock(async (projectId: string) => ({
      projectId,
      syncStatus: 'payment_required',
      billingState: 'free',
      billingInterval: null,
      billingUrl: 'https://cli.prjct.app/billing',
      message: 'Repo linked. Subscribe to activate Cloud sync.',
    })) as never

    const res = await cloud.cloud('link', tempDir, { md: true })
    const config = await configManager.readConfig(tempDir)

    expect(res.success).toBe(false)
    expect(res.paymentRequired).toBe(true)
    expect(config?.cloud?.enabled).toBe(true)
    expect(syncManager.sync).not.toHaveBeenCalled()
  })

  test('pause / resume toggle config.cloud.paused once linked', async () => {
    const config = await configManager.readConfig(tempDir)
    if (!config) throw new Error('no config')
    config.cloud = { enabled: true }
    await configManager.writeConfig(tempDir, config)

    await cloud.cloud('pause', tempDir, { md: true })
    expect((await configManager.readConfig(tempDir))?.cloud?.paused).toBe(true)

    await cloud.cloud('resume', tempDir, { md: true })
    expect((await configManager.readConfig(tempDir))?.cloud?.paused).toBe(false)
  })

  test('unlink sets enabled=false, leaving the block in place', async () => {
    const config = await configManager.readConfig(tempDir)
    if (!config) throw new Error('no config')
    config.cloud = { enabled: true, linkedAt: '2026-06-19T00:00:00Z' }
    await configManager.writeConfig(tempDir, config)

    const res = await cloud.cloud('unlink', tempDir, { md: true })
    expect(res.success).toBe(true)
    expect((await configManager.readConfig(tempDir))?.cloud?.enabled).toBe(false)
  })

  test('status reports linked + paused state', async () => {
    const config = await configManager.readConfig(tempDir)
    if (!config) throw new Error('no config')
    config.cloud = { enabled: true, paused: true }
    await configManager.writeConfig(tempDir, config)

    const res = await cloud.cloud('status', tempDir, { md: true })
    expect(res.success).toBe(true)
    expect(res.linked).toBe(true)
    expect(res.paused).toBe(true)
  })

  test('unknown subcommand fails cleanly', async () => {
    const res = await cloud.cloud('frobnicate', tempDir, { md: true })
    expect(res.success).toBe(false)
    expect(res.error).toContain('Unknown cloud subcommand')
  })
})
