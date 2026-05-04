/**
 * ideas-storage tests — Phase 1.5 / B1 coverage gate.
 *
 * The storage extends StorageManager so publishEvent is exercised
 * indirectly. These tests cover addIdea / getById / archive /
 * setPriority / convertToFeature / removeIdea so the coverage gate
 * (≥80% on core/storage/*-storage.ts) clears for ideas.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import prjctDb from '../../storage/database'
import { ideasStorage } from '../../storage/ideas-storage'

let tempDir: string
let originalProjectsDir: string | undefined
let projectId: string

describe('ideas-storage', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-ideas-test-'))
    originalProjectsDir = process.env.PRJCT_PROJECTS_DIR
    process.env.PRJCT_PROJECTS_DIR = tempDir
    projectId = `ideas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    prjctDb.run(projectId, 'SELECT 1 WHERE 1=0')
  })

  afterEach(async () => {
    if (originalProjectsDir === undefined) delete process.env.PRJCT_PROJECTS_DIR
    else process.env.PRJCT_PROJECTS_DIR = originalProjectsDir
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('addIdea + getById round-trips with priority + tags', async () => {
    const idea = await ideasStorage.addIdea(projectId, 'rate limit auth', {
      priority: 'high',
      tags: ['domain:auth', 'priority:p0'],
    })
    expect(idea.id).toBeTruthy()
    expect(idea.priority).toBe('high')
    expect(idea.tags).toEqual(['domain:auth', 'priority:p0'])

    const fetched = await ideasStorage.getById(projectId, idea.id)
    expect(fetched).toBeTruthy()
    expect(fetched?.text).toBe('rate limit auth')
  })

  test('getAll returns ideas; getPending filters archived out', async () => {
    const a = await ideasStorage.addIdea(projectId, 'A')
    const b = await ideasStorage.addIdea(projectId, 'B')
    expect((await ideasStorage.getAll(projectId)).length).toBe(2)

    await ideasStorage.archive(projectId, a.id)
    const pending = await ideasStorage.getPending(projectId)
    expect(pending.map((i) => i.id)).toEqual([b.id])
  })

  test('archive marks status archived', async () => {
    const i = await ideasStorage.addIdea(projectId, 'archive me')
    await ideasStorage.archive(projectId, i.id)
    const after = await ideasStorage.getById(projectId, i.id)
    expect(after?.status).toBe('archived')
  })

  test('setPriority updates priority', async () => {
    const i = await ideasStorage.addIdea(projectId, 'maybe', { priority: 'low' })
    await ideasStorage.setPriority(projectId, i.id, 'high')
    const after = await ideasStorage.getById(projectId, i.id)
    expect(after?.priority).toBe('high')
  })

  test('addTags appends without dupes', async () => {
    const i = await ideasStorage.addIdea(projectId, 'tagged', {
      tags: ['domain:auth'],
    })
    await ideasStorage.addTags(projectId, i.id, ['domain:auth', 'priority:p1'])
    const after = await ideasStorage.getById(projectId, i.id)
    expect((after?.tags ?? []).sort()).toEqual(['domain:auth', 'priority:p1'])
  })

  test('removeIdea drops the row', async () => {
    const i = await ideasStorage.addIdea(projectId, 'gone')
    await ideasStorage.removeIdea(projectId, i.id)
    expect(await ideasStorage.getById(projectId, i.id)).toBeUndefined()
  })

  test('convertToFeature transitions status to converted', async () => {
    const i = await ideasStorage.addIdea(projectId, 'will convert')
    await ideasStorage.convertToFeature(projectId, i.id, 'feat-123')
    const after = await ideasStorage.getById(projectId, i.id)
    expect(after?.status).toBe('converted')
    expect(after?.convertedTo).toBe('feat-123')
  })

  test('getCounts groups by status', async () => {
    const a = await ideasStorage.addIdea(projectId, 'A')
    await ideasStorage.addIdea(projectId, 'B')
    await ideasStorage.archive(projectId, a.id)
    const counts = await ideasStorage.getCounts(projectId)
    expect(counts.archived).toBe(1)
    expect(counts.pending).toBe(1)
    expect(counts.converted).toBe(0)
  })
})
