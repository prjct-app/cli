/**
 * Anti-basura capture + junk forget.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import configManager from '../../infrastructure/config-manager'
import { projectMemory } from '../../memory/project-memory'
import { isJunkCaptureContent } from '../../services/capture-junk'
import { captureGate, forgetJunkCaptures } from '../../services/retention'
import { prjctDb } from '../../storage/database'
import { patchPathManager, restorePathManager } from '../_setup/path-manager-mock'

describe('isJunkCaptureContent', () => {
  it('flags tool dumps and short noise', () => {
    expect(isJunkCaptureContent('todo_write').junk).toBe(true)
    expect(isJunkCaptureContent('judgment status').junk).toBe(true)
    expect(isJunkCaptureContent('mem get mem_5869').junk).toBe(true)
    expect(isJunkCaptureContent('wip').junk).toBe(true)
    expect(isJunkCaptureContent('ok').junk).toBe(true)
  })

  it('allows real knowledge', () => {
    expect(
      isJunkCaptureContent(
        'Never embed project name into the global skill body — multi-project poison'
      ).junk
    ).toBe(false)
    expect(
      isJunkCaptureContent('Use SQLite as the single source of truth for project memory').junk
    ).toBe(false)
  })
})

describe('captureGate + forgetJunkCaptures', () => {
  let projectPath: string
  let projectId: string

  beforeEach(async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-junk-'))
    await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
    projectId = `junk-${Math.random().toString(36).slice(2, 10)}`
    await configManager.writeConfig(projectPath, {
      projectId,
      dataPath: path.join(projectPath, '.prjct-data'),
    })
    patchPathManager(projectPath)
    prjctDb.get(projectId, 'SELECT 1')
    // Seed vault so excess gate is not "empty vault — seed"
    await projectMemory.remember(projectPath, {
      type: 'decision',
      content: 'Seed decision so the vault is non-empty for capture gate tests',
      tags: {},
      provenance: 'declared',
      projectId,
    })
  })

  afterEach(async () => {
    restorePathManager()
    if (projectPath) await fs.rm(projectPath, { recursive: true, force: true }).catch(() => {})
  })

  it('refuses junk at captureGate even for judgment types', () => {
    const g = captureGate(projectId, 'decision', 'todo_write')
    expect(g.accept).toBe(false)
    expect(g.reason).toMatch(/junk/i)
  })

  it('forgets junk inbox rows on cleanup pass', async () => {
    // Bypass gate by writing raw rows (simulates pre-gate pollution)
    prjctDb.run(
      projectId,
      `INSERT INTO memory_entries (
        id, project_id, type, title, content, provenance, content_hash,
        user_triggered, revision_count, created_at, updated_at, deleted_at
      ) VALUES (?, ?, 'inbox', 'noise', ?, 'declared', ?, 0, 0, ?, ?, NULL)`,
      'mem_junk1',
      projectId,
      'todo_write',
      'hash-junk-1',
      Date.now(),
      Date.now()
    )
    const r = forgetJunkCaptures(projectId, { max: 10 })
    expect(r.forgotten).toBeGreaterThanOrEqual(1)
    const still = prjctDb.get<{ id: string }>(
      projectId,
      "SELECT id FROM memory_entries WHERE id = 'mem_junk1' AND deleted_at IS NULL"
    )
    expect(still).toBeNull()
  })
})
