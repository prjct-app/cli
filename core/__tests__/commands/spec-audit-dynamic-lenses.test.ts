/**
 * `prjct spec audit` — dynamic lenses, end to end.
 *
 * Pins the behavior change: audit no longer dispatches a FIXED trio
 * (strategic / architecture / design). It computes a per-spec lens set,
 * persists it as `selected_reviewers`, and the auto-promote gate checks
 * exactly that set — so a 1-lens spec promotes on a single passing review,
 * and an open-vocab lens (security/data/…) counts toward the gate.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { SpecCommands } from '../../commands/spec'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import { specService } from '../../services/spec-service'
import prjctDb from '../../storage/database'

let projectPath: string
let projectId: string
let originalProjectsDir: string | undefined
let cmd: SpecCommands

async function freshProject(): Promise<void> {
  const tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-audit-lens-pd-'))
  originalProjectsDir = process.env.PRJCT_PROJECTS_DIR
  process.env.PRJCT_PROJECTS_DIR = tempProjectsDir

  projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-audit-lens-'))
  await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
  projectId = `lens-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await configManager.writeConfig(projectPath, {
    projectId,
    dataPath: path.join(projectPath, '.prjct-data'),
  } as Parameters<typeof configManager.writeConfig>[1])
  await pathManager.ensureProjectStructure(projectId)
  prjctDb.run(projectId, 'SELECT 1 WHERE 1=0')
}

beforeEach(async () => {
  prjctDb.close()
  await freshProject()
  cmd = new SpecCommands()
})

afterEach(async () => {
  if (originalProjectsDir === undefined) delete process.env.PRJCT_PROJECTS_DIR
  else process.env.PRJCT_PROJECTS_DIR = originalProjectsDir
  if (projectPath) await fs.rm(projectPath, { recursive: true, force: true }).catch(() => {})
  prjctDb.close()
})

describe('prjct spec audit — dynamic lenses', () => {
  test('persists a spec-shaped lens set, not the fixed trio', async () => {
    const created = await specService.create(projectPath, {
      title: 'auth + migration',
      content: {
        goal: 'Add token auth and a DB schema migration for sessions',
        scope: ['core/auth/session.ts'],
      },
      autoContext: false,
    })

    const res = await cmd.audit(created.id, projectPath, {})
    expect(res.success).toBe(true)

    const lenses =
      (await specService.get(projectPath, created.id))?.content.selected_reviewers ?? []
    expect(lenses).toContain('architecture')
    expect(lenses).toContain('security')
    expect(lenses).toContain('data')
    expect(lenses).not.toContain('design') // no UI/CLI surface signalled
  })

  test('--lenses override persists exactly the given set', async () => {
    const created = await specService.create(projectPath, {
      title: 'doc tweak',
      content: { goal: 'Clarify the README intro' },
      autoContext: false,
    })

    await cmd.audit(created.id, projectPath, { lenses: 'architecture' })
    expect((await specService.get(projectPath, created.id))?.content.selected_reviewers).toEqual([
      'architecture',
    ])
  })

  test('a single-lens spec auto-promotes after ONE passing review', async () => {
    const created = await specService.create(projectPath, {
      title: 'trivial',
      content: { goal: 'Fix a typo in the README' },
      autoContext: false,
    })

    await cmd.audit(created.id, projectPath, {}) // baseline → ['architecture']
    expect((await specService.get(projectPath, created.id))?.status).toBe('draft')

    const res = await cmd.recordReview(created.id, projectPath, {
      reviewer: 'architecture',
      verdict: 'pass',
      notes: 'feasible',
    })
    expect(res.success).toBe(true)
    expect((await specService.get(projectPath, created.id))?.status).toBe('reviewed')
  })

  test('open-vocab lens (security) is accepted and counts toward the gate', async () => {
    const created = await specService.create(projectPath, {
      title: 'auth change',
      content: { goal: 'Add token auth to the api', scope: ['core/auth/x.ts'] },
      autoContext: false,
    })

    await cmd.audit(created.id, projectPath, { lenses: 'security' })
    const res = await cmd.recordReview(created.id, projectPath, {
      reviewer: 'security',
      verdict: 'pass',
      notes: 'threat model ok',
    })
    expect(res.success).toBe(true)
    expect((await specService.get(projectPath, created.id))?.status).toBe('reviewed')
  })

  test('does not promote until ALL selected lenses pass', async () => {
    const created = await specService.create(projectPath, {
      title: 'multi lens',
      content: { goal: 'Add token auth and a DB migration', scope: ['core/auth/x.ts'] },
      autoContext: false,
    })
    await cmd.audit(created.id, projectPath, { lenses: 'architecture,security,data' })

    await cmd.recordReview(created.id, projectPath, {
      reviewer: 'architecture',
      verdict: 'pass',
      notes: 'ok',
    })
    await cmd.recordReview(created.id, projectPath, {
      reviewer: 'security',
      verdict: 'pass',
      notes: 'ok',
    })
    // data not yet recorded → still draft
    expect((await specService.get(projectPath, created.id))?.status).toBe('draft')

    await cmd.recordReview(created.id, projectPath, {
      reviewer: 'data',
      verdict: 'pass',
      notes: 'ok',
    })
    expect((await specService.get(projectPath, created.id))?.status).toBe('reviewed')
  })
})
