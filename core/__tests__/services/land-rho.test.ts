/**
 * Land Rho dry-run (Dynasty D5).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import configManager from '../../infrastructure/config-manager'
import { runLandRhoDryRun } from '../../services/land-rho'
import { prjctDb } from '../../storage/database'
import { patchPathManager, restorePathManager } from '../_setup/path-manager-mock'

describe('land-rho', () => {
  let projectPath: string
  let projectId: string

  beforeEach(async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-land-rho-'))
    await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
    projectId = `land-rho-${Math.random().toString(36).slice(2, 10)}`
    await configManager.writeConfig(projectPath, {
      projectId,
      dataPath: path.join(projectPath, '.prjct-data'),
    })
    patchPathManager(projectPath)
    prjctDb.get(projectId, 'SELECT 1')
  })

  afterEach(async () => {
    restorePathManager()
    if (projectPath) await fs.rm(projectPath, { recursive: true, force: true }).catch(() => {})
  })

  it('returns a scannable mass line on fresh project', () => {
    const r = runLandRhoDryRun(projectId)
    expect(r).not.toBeNull()
    expect(r!.line).toMatch(/Memory mass|Rho dry-run/i)
    expect(r!.live).toBeGreaterThanOrEqual(0)
    expect(r!.wouldArchive).toBeGreaterThanOrEqual(0)
    expect(r!.md).toContain('Memory mass')
  })
})
