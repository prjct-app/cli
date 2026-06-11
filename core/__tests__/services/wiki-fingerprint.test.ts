/**
 * Vault regen fingerprint — staleness contract.
 *
 * The fingerprint short-circuits vault regeneration. Until PR-B it did
 * NOT include the CLI version, so upgrading prjct never invalidated the
 * vault: a new builder format silently never rendered until unrelated
 * inputs changed (this bit us live — the installed old version stamped
 * the fingerprint and blocked the new vault v2 output). Pins:
 *   1. The fingerprint embeds the running CLI version.
 *   2. Same inputs → identical fingerprint (the cache still works).
 */

import { afterAll, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import pathManager from '../../infrastructure/path-manager'
import { computeRegenFingerprint, REGEN_SCHEMA_VERSION } from '../../services/wiki/fingerprint'
import prjctDb from '../../storage/database'
import { VERSION } from '../../utils/version'

// computeRegenFingerprint opens the project DB, which creates the
// project dir under the global projects root — clean it up so test runs
// don't accumulate dirs there (the upgrade-scan pollution class).
const PROJECT_ID = `wiki-fingerprint-test-${process.pid}`

afterAll(async () => {
  prjctDb.close()
  await fs
    .rm(pathManager.getGlobalProjectPath(PROJECT_ID), { recursive: true, force: true })
    .catch(() => {})
})

describe('computeRegenFingerprint', () => {
  test('embeds CLI version so upgrades invalidate every vault once', async () => {
    const fp = await computeRegenFingerprint('/nonexistent-project-path', PROJECT_ID)
    expect(fp).toContain(`cli${VERSION}`)
    expect(fp).toContain(`v${REGEN_SCHEMA_VERSION}`)
  })

  test('is deterministic for identical inputs', async () => {
    const a = await computeRegenFingerprint('/nonexistent-project-path', PROJECT_ID)
    const b = await computeRegenFingerprint('/nonexistent-project-path', PROJECT_ID)
    expect(a).toBe(b)
  })
})
