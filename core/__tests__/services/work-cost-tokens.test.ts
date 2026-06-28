import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import { buildWorkCostSnapshot, recordTaskTokenUsage } from '../../services/work-cost-service'
import { prjctDb } from '../../storage/database'

let projectPath: string
let tmpRoot: string
let projectId: string
const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

describe('agent-agnostic token measurement', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-tok-root-'))
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-tok-project-'))
    projectId = `tok-${Math.random().toString(36).slice(2, 10)}`
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

  it('records token usage as an event and surfaces it as a measured cycle (no tasks-table row needed)', () => {
    // The live work flow never writes the legacy `tasks` table, so this is the
    // path that actually proves net savings for any agent.
    recordTaskTokenUsage(projectId, 'task-x', 18000, 4000, {
      description: 'measured via CLI/MCP',
      agent: 'codex',
    })

    const snapshot = buildWorkCostSnapshot(projectId, 30)
    expect(snapshot.knownTokenCycles).toBe(1)
    expect(snapshot.tokensTotal).toBe(22000)
    expect(snapshot.mostExpensive[0]?.description).toBe('measured via CLI/MCP')
  })

  it('uses the latest report per task (SET semantics, not increment)', () => {
    recordTaskTokenUsage(projectId, 'task-y', 1000, 100)
    recordTaskTokenUsage(projectId, 'task-y', 5000, 900)

    const snapshot = buildWorkCostSnapshot(projectId, 30)
    expect(snapshot.knownTokenCycles).toBe(1)
    expect(snapshot.tokensTotal).toBe(5900)
  })
})
