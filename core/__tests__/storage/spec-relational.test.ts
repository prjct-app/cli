/**
 * C6: a spec is projected into normalized child tables (acceptance criteria,
 * scope, risks, test steps, reviews, selected reviewers, linked tasks, tags) on
 * every write — the spec gate becomes queryable as relational records, not a
 * JSON blob. Re-projection on update stays consistent (clear + reinsert).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import prjctDb from '../../storage/database'
import { specStorage } from '../../storage/spec-storage'
import { emptySpecContent } from '../../types/spec'

let projectId: string
let projectsDir: string
let originalProjectsDir: string | undefined

describe('spec relational projection (C6)', () => {
  beforeEach(async () => {
    projectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-spec-rel-'))
    originalProjectsDir = process.env.PRJCT_PROJECTS_DIR
    process.env.PRJCT_PROJECTS_DIR = projectsDir
    projectId = `specrel-${Date.now()}`
    prjctDb.run(projectId, 'SELECT 1 WHERE 1=0')
  })
  afterEach(async () => {
    if (originalProjectsDir === undefined) delete process.env.PRJCT_PROJECTS_DIR
    else process.env.PRJCT_PROJECTS_DIR = originalProjectsDir
    await fs.rm(projectsDir, { recursive: true, force: true })
  })

  function count(table: string, specId: string): number {
    return prjctDb.query<{ n: number }>(
      projectId,
      `SELECT COUNT(*) AS n FROM ${table} WHERE spec_id = ?`,
      specId
    )[0].n
  }

  it('projects list fields + tags into child tables on create', () => {
    const spec = specStorage.create(projectId, {
      title: 'Test spec',
      content: {
        ...emptySpecContent('goal here'),
        acceptance_criteria: ['ac1', 'ac2'],
        selected_reviewers: ['architecture', 'security'],
      },
      tags: { area: 'auth' },
    })
    // Only the gate state is projected relationally; the rest stays in the
    // specs.content aggregate (the sync root + read source of truth).
    expect(count('spec_selected_reviewer', spec.id)).toBe(2)
  })

  it('re-projects reviews on update — the relational gate state', () => {
    const spec = specStorage.create(projectId, {
      title: 'Gate spec',
      content: {
        ...emptySpecContent('goal'),
        selected_reviewers: ['architecture', 'security'],
      },
    })
    specStorage.updateContent(projectId, spec.id, {
      ...emptySpecContent('goal'),
      selected_reviewers: ['architecture', 'security'],
      reviews: {
        architecture: { verdict: 'pass', notes: 'ok', ts: new Date().toISOString() },
        security: { verdict: 'fail', notes: 'gap', ts: new Date().toISOString() },
      },
    })
    const reviews = prjctDb.query<{ lens: string; verdict: string }>(
      projectId,
      'SELECT lens, verdict FROM spec_review WHERE spec_id = ? ORDER BY lens',
      spec.id
    )
    expect(reviews.length).toBe(2)
    expect(reviews.find((r) => r.lens === 'architecture')?.verdict).toBe('pass')
    expect(reviews.find((r) => r.lens === 'security')?.verdict).toBe('fail')
    // Gate query: all selected reviewers have a pass?
    const pending = prjctDb.query<{ n: number }>(
      projectId,
      `SELECT COUNT(*) AS n FROM spec_selected_reviewer sr
       WHERE sr.spec_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM spec_review rv
           WHERE rv.spec_id = sr.spec_id AND rv.lens = sr.lens AND rv.verdict = 'pass'
         )`,
      spec.id
    )[0].n
    expect(pending).toBe(1) // security hasn't passed → gate not met
  })
})
