import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ProductCommands } from '../../commands/product'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import { publishWorkCostSnapshots, type WorkCostSnapshot } from '../../services/work-cost-service'
import { prjctDb } from '../../storage/database'
import { syncPendingStorage } from '../../storage/sync-pending-storage'

let projectPath: string
let tmpRoot: string
let projectId: string

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

describe('insights cost', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-cost-root-'))
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-cost-project-'))
    projectId = `cost-${Math.random().toString(36).slice(2, 10)}`
    pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot, id)
    await configManager.writeConfig(projectPath, {
      projectId,
      dataPath: path.join(tmpRoot, 'data'),
    })
    prjctDb.getDb(projectId)
  })

  afterEach(async () => {
    prjctDb.close()
    pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
    await fs.rm(projectPath, { recursive: true, force: true })
    await fs.rm(tmpRoot, { recursive: true, force: true })
  })

  it('reports measured token burn and most expensive work cycles', async () => {
    const log = spyOn(console, 'log').mockImplementation(() => {})
    const now = new Date().toISOString()
    try {
      prjctDb.run(
        projectId,
        `INSERT INTO tasks
         (id, description, status, started_at, completed_at, tokens_in, tokens_out)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        'task-1',
        'Fix cloud context chronology',
        'completed',
        now,
        now,
        12000,
        3000
      )
      prjctDb.run(
        projectId,
        `INSERT INTO memory_surface_log (memory_id, task_id, created_at, query_text, surface)
         VALUES (?, ?, ?, ?, ?)`,
        'mem_1',
        'task-1',
        now,
        'cloud chronology',
        'work'
      )
      prjctDb.run(
        projectId,
        `INSERT INTO memory_usefulness (memory_id, score, ref_count, fetch_count, last_used_at)
         VALUES (?, ?, ?, ?, ?)`,
        'mem_1',
        1,
        1,
        1,
        now
      )

      const result = await new ProductCommands().cost('30', projectPath, { md: true })
      const snapshot = result as typeof result & WorkCostSnapshot

      expect(result.success).toBe(true)
      expect(snapshot.tokensTotal).toBe(15000)
      expect(snapshot.tokenCoveragePercent).toBe(100)
      expect(snapshot.surfacedContext).toBe(1)
    } finally {
      log.mockRestore()
    }
  })

  it('rescues historical work and declared token usage from events', async () => {
    const log = spyOn(console, 'log').mockImplementation(() => {})
    const now = new Date().toISOString()
    try {
      prjctDb.appendEvent(projectId, 'memory.task_started', {
        task: 'Investigate repeated agent exploration',
        taskId: 'task-historical',
      })
      prjctDb.appendEvent(projectId, 'memory.feature_shipped', {
        feature: 'file cue rollout',
      })
      prjctDb.appendEvent(projectId, 'memory.remember.context', {
        content:
          'Claude spent about 55k tokens exploring existing code because file cues were missing.',
      })
      prjctDb.run(
        projectId,
        'UPDATE events SET timestamp = ? WHERE type IN (?, ?, ?)',
        now,
        'memory.task_started',
        'memory.feature_shipped',
        'memory.remember.context'
      )

      const result = await new ProductCommands().cost('30', projectPath, { md: true })
      const snapshot = result as typeof result & WorkCostSnapshot

      expect(result.success).toBe(true)
      expect(snapshot.workCycles).toBe(1)
      expect(snapshot.historicalRescue.eventWorkStarts).toBe(1)
      expect(snapshot.historicalRescue.eventShips).toBe(1)
      expect(snapshot.historicalRescue.declaredTokensTotal).toBe(55000)
      expect(snapshot.gaps).toContain(
        'Work history was rescued from events, but normalized task rows are missing.'
      )
    } finally {
      log.mockRestore()
    }
  })

  it('keeps missing task/session/token capture visible', async () => {
    const log = spyOn(console, 'log').mockImplementation(() => {})
    try {
      const result = await new ProductCommands().cost('30', projectPath, { md: true })
      const snapshot = result as typeof result & WorkCostSnapshot

      expect(result.success).toBe(true)
      expect(snapshot.workCycles).toBe(0)
      expect(snapshot.gaps).toContain(
        'No work cycles were found in tasks or historical events for this window.'
      )
    } finally {
      log.mockRestore()
    }
  })

  it('publishes retrospective snapshots as sync analytics events', async () => {
    await publishWorkCostSnapshots(projectId, [30])

    const pending = syncPendingStorage.list(projectId)
    expect(pending).toHaveLength(1)
    expect(pending[0]?.event.entityType).toBe('work_cost_snapshots')
    expect(pending[0]?.event.entityId).toBe('work-cost-30d')
    expect(pending[0]?.event.eventType).toBe('upsert')
  })
})
