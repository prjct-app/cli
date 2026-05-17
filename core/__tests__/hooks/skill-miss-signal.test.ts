/**
 * Harness #16 surfacing — `buildImprovementSignals` carries both
 * detectors under ONE block with per-source budgets.
 *
 * Pins: skill-miss renders under the existing header with a
 * [skill-miss] label (no parallel block); the `resolves:skill-miss`
 * prose is present; a noisy friction session cannot starve skill-miss
 * out of the shared 24h window (per-source budget, not a flat cap).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildImprovementSignals } from '../../hooks/prompt'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import prjctDb from '../../storage/database'

let projectPath: string
let projectId: string

async function freshProject(): Promise<void> {
  projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-skillmiss-signal-'))
  await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
  projectId = `skillmiss-sig-${crypto.randomUUID()}`
  await configManager.writeConfig(projectPath, {
    projectId,
    dataPath: path.join(projectPath, '.prjct-data'),
  } as Parameters<typeof configManager.writeConfig>[1])
  await pathManager.ensureProjectStructure(projectId)
}

function appendFriction(i: number): void {
  prjctDb.appendEvent(projectId, 'memory.remember.improvement-signal', {
    content: `[negation] User pushback: "no, friction ${i}"`,
    tags: { source: 'friction-detector', category: 'negation', key: `f${i}` },
    provenance: 'extracted',
  })
}

function appendSkillMiss(i: number): void {
  prjctDb.appendEvent(projectId, 'memory.remember.improvement-signal', {
    content: `[skill-miss] Unused project knowledge (decision, mem_${i}): "do X the captured way"`,
    tags: {
      source: 'skill-miss-detector',
      kind: 'skill-miss',
      category: 'skill-miss',
      relates: `mem_${i}`,
      key: `s${i}`,
    },
    provenance: 'extracted',
  })
}

beforeEach(async () => {
  prjctDb.close()
})

afterEach(async () => {
  if (projectPath) await fs.rm(projectPath, { recursive: true, force: true }).catch(() => {})
  prjctDb.close()
})

describe('buildImprovementSignals — harness #16 widening', () => {
  it('surfaces a skill-miss under the existing block with a [skill-miss] label', async () => {
    await freshProject()
    appendSkillMiss(1)
    const r = await buildImprovementSignals(projectPath)
    expect(r).not.toBeNull()
    expect(r).toContain('# prjct: improvement signals')
    expect(r).toContain('(friction + skill-miss)')
    expect(r).toContain('[skill-miss] Unused project knowledge')
    expect(r).toContain('resolves:skill-miss')
  })

  it('does not starve skill-miss when friction is noisy (per-source budget)', async () => {
    await freshProject()
    for (let i = 0; i < 5; i++) appendFriction(i)
    for (let i = 0; i < 5; i++) appendSkillMiss(i)
    const r = await buildImprovementSignals(projectPath)
    expect(r).not.toBeNull()
    const frictionLines = (r!.match(/- \[negation\]/g) ?? []).length
    const skillMissLines = (r!.match(/- \[skill-miss\]/g) ?? []).length
    expect(frictionLines).toBe(3) // FRICTION_BUDGET
    expect(skillMissLines).toBe(2) // SKILL_MISS_BUDGET — survived the friction flood
    expect(r).toContain('5 signals captured at last session-end')
  })

  it('still works with only skill-miss signals (no friction)', async () => {
    await freshProject()
    appendSkillMiss(99)
    const r = await buildImprovementSignals(projectPath)
    expect(r).not.toBeNull()
    expect(r).toContain('1 signal captured at last session-end')
    expect(r).toContain('[skill-miss]')
  })

  it('ignores skill-miss signals older than 24h', async () => {
    await freshProject()
    const oldTs = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    prjctDb.run(
      projectId,
      "INSERT INTO events (type, data, timestamp) VALUES ('memory.remember.improvement-signal', ?, ?)",
      JSON.stringify({
        content: '[skill-miss] stale',
        tags: { source: 'skill-miss-detector', category: 'skill-miss', key: 'old' },
        provenance: 'extracted',
      }),
      oldTs
    )
    const r = await buildImprovementSignals(projectPath)
    expect(r).toBeNull()
  })
})
