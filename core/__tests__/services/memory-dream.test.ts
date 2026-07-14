/**
 * Memory auto-dream + L0 index (Claude Code KAIROS steal).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import configManager from '../../infrastructure/config-manager'
import { projectMemory } from '../../memory/project-memory'
import {
  evaluateDreamGates,
  loadDreamStamp,
  recordDreamSession,
  runMemoryDream,
} from '../../services/memory-dream'
import {
  buildAndStoreMemoryL0Index,
  buildMemoryL0Index,
  isMemoryL0IndexFresh,
  L0_INDEX_MAX_CHARS,
  loadMemoryL0Index,
} from '../../services/memory-index'
import { prjctDb } from '../../storage/database'
import { patchPathManager, restorePathManager } from '../_setup/path-manager-mock'

describe('memory-index L0', () => {
  let projectPath: string
  let projectId: string

  beforeEach(async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-mem-idx-'))
    await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
    projectId = `mem-idx-${Math.random().toString(36).slice(2, 10)}`
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

  it('builds empty-vault index with live=0', () => {
    const stamp = buildMemoryL0Index({ projectId, source: 'manual' })
    expect(stamp).not.toBeNull()
    expect(stamp!.live).toBe(0)
    expect(stamp!.markdown).toMatch(/live=0/i)
    expect(stamp!.markdown.length).toBeLessThanOrEqual(L0_INDEX_MAX_CHARS)
  })

  it('indexes remembered decisions and gotchas under hard char cap', async () => {
    await projectMemory.remember(projectPath, {
      type: 'decision',
      content: 'Use SQLite as single source of truth for project memory',
      tags: { topic: 'architecture' },
      provenance: 'declared',
      projectId,
    })
    await projectMemory.remember(projectPath, {
      type: 'gotcha',
      content: 'Never embed project name into global skill body',
      tags: { topic: 'skill' },
      provenance: 'declared',
      projectId,
    })

    const stamp = buildAndStoreMemoryL0Index({ projectId, source: 'manual' })
    expect(stamp).not.toBeNull()
    expect(stamp!.live).toBeGreaterThanOrEqual(2)
    expect(stamp!.markdown).toMatch(/memory index \(L0\)/i)
    expect(stamp!.markdown).toMatch(/decision|Decisions/i)
    expect(stamp!.markdown.length).toBeLessThanOrEqual(L0_INDEX_MAX_CHARS)

    const loaded = loadMemoryL0Index(projectId)
    expect(loaded?.markdown).toBe(stamp!.markdown)
    expect(isMemoryL0IndexFresh(loaded)).toBe(true)
  })
})

describe('memory-dream', () => {
  let projectPath: string
  let projectId: string

  beforeEach(async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-mem-dream-'))
    await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
    projectId = `mem-dream-${Math.random().toString(36).slice(2, 10)}`
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

  it('first dream is allowed (no lastDreamAt)', () => {
    const gate = evaluateDreamGates(projectId)
    expect(gate.ok).toBe(true)
    expect(gate.reasons).toContain('first-dream')
  })

  it('session gate blocks until enough lands after a dream', async () => {
    await projectMemory.remember(projectPath, {
      type: 'fact',
      content: 'seed fact for dream test',
      tags: {},
      provenance: 'declared',
      projectId,
    })

    const first = runMemoryDream({ projectId, force: true, dryRun: false })
    expect(first.ran).toBe(true)
    expect(first.skipped).toBe(false)

    const stamp = loadDreamStamp(projectId)
    expect(stamp?.lastDreamAt).toBeTruthy()
    expect(stamp?.sessionsSinceDream).toBe(0)

    // Immediately after dream, time+session gates should block.
    const blocked = evaluateDreamGates(projectId, { minHours: 24, minSessions: 5 })
    expect(blocked.ok).toBe(false)
    expect(
      blocked.reasons.some((r) => r.startsWith('session-gate') || r.startsWith('time-gate'))
    ).toBe(true)

    // Bump sessions without waiting 24h — still blocked by time.
    for (let i = 0; i < 5; i++) recordDreamSession(projectId)
    const stillTime = evaluateDreamGates(projectId, { minHours: 24, minSessions: 5 })
    expect(stillTime.ok).toBe(false)
    expect(stillTime.reasons.some((r) => r.startsWith('time-gate'))).toBe(true)

    // Force bypasses.
    const forced = evaluateDreamGates(projectId, { force: true })
    expect(forced.ok).toBe(true)
  })

  it('dry-run does not write dream stamp or apply retention counts as real', async () => {
    await projectMemory.remember(projectPath, {
      type: 'inbox',
      content: 'noise capture for dry-run',
      tags: { source: 'test' },
      provenance: 'declared',
      projectId,
    })

    const dry = runMemoryDream({ projectId, force: true, dryRun: true })
    expect(dry.ran).toBe(true)
    expect(dry.dryRun).toBe(true)
    expect(dry.phases.consolidate.archived).toBe(0)
    expect(dry.phases.consolidate.deleted).toBe(0)

    // Stamp should not advance lastDreamAt on dry-run (still first or unchanged).
    const stamp = loadDreamStamp(projectId)
    // dry-run may leave no stamp or previous; must not mark a successful dream
    // with lastResult.dryRun false
    if (stamp?.lastResult) {
      expect(stamp.lastResult.dryRun).not.toBe(false)
    }
  })

  it('force dream rebuilds L0 index', async () => {
    await projectMemory.remember(projectPath, {
      type: 'learning',
      content: 'Dream rebuilds the L0 compact index for SessionStart',
      tags: { topic: 'memory' },
      provenance: 'declared',
      projectId,
    })

    const report = runMemoryDream({ projectId, force: true, dryRun: false })
    expect(report.ran).toBe(true)
    expect(report.phases.prune.indexBuilt).toBe(true)
    expect(report.line).toMatch(/Dream complete/i)

    const idx = loadMemoryL0Index(projectId)
    expect(idx?.source).toBe('dream')
    expect(idx?.markdown).toMatch(/L0/i)
  })
})
