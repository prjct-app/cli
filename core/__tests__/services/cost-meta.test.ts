/**
 * WS-B: recordTaskTokenUsage captures model / runtime / isEstimated / source
 * in the token event payload (the write side of the telemetry redesign — a
 * narrow `addCost`-style verb feeds these). Exact-vs-estimated must survive.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { recordTaskTokenUsage, TASK_TOKENS_EVENT } from '../../services/work-cost-service'
import { prjctDb } from '../../storage/database'

let tmpRoot: string
let projectId: string
const original = pathManager.getGlobalProjectPath.bind(pathManager)

describe('recordTaskTokenUsage meta', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-cost-meta-'))
    projectId = `costmeta-${Math.random().toString(36).slice(2, 10)}`
    pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot, id)
    prjctDb.getDb(projectId)
  })

  afterEach(async () => {
    prjctDb.close()
    pathManager.getGlobalProjectPath = original
    await fs.rm(tmpRoot, { recursive: true, force: true })
  })

  function lastTokenEvent(): Record<string, unknown> {
    const rows = prjctDb.query<{ data: string }>(
      projectId,
      'SELECT data FROM events WHERE type = ? ORDER BY id DESC LIMIT 1',
      TASK_TOKENS_EVENT
    )
    expect(rows.length).toBe(1)
    return JSON.parse(rows[0].data)
  }

  it('persists model, runtime, isEstimated and source', () => {
    recordTaskTokenUsage(projectId, 'task-1', 1000, 200, {
      model: 'claude-opus-4-8',
      runtime: 'claude',
      isEstimated: false,
      source: 'mcp',
    })
    const data = lastTokenEvent()
    expect(data.tokensIn).toBe(1000)
    expect(data.tokensOut).toBe(200)
    expect(data.model).toBe('claude-opus-4-8')
    expect(data.runtime).toBe('claude')
    expect(data.isEstimated).toBe(false)
    expect(data.source).toBe('mcp')
  })

  it('omits unknown fields and keeps backward-compatible payload', () => {
    recordTaskTokenUsage(projectId, 'task-2', 5, 5)
    const data = lastTokenEvent()
    expect(data.taskId).toBe('task-2')
    expect('model' in data).toBe(false)
    expect('isEstimated' in data).toBe(false)
  })

  it('marks estimated counts explicitly', () => {
    recordTaskTokenUsage(projectId, 'task-3', 10, 10, { isEstimated: true, source: 'cli' })
    const data = lastTokenEvent()
    expect(data.isEstimated).toBe(true)
    expect(data.source).toBe('cli')
  })
})
