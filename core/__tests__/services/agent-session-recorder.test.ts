import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import {
  recordAgentSessionEnd,
  recordAgentSessionStart,
} from '../../services/agent-session-recorder'
import { prjctDb } from '../../storage/database'

let projectPath: string
let tmpRoot: string
let projectId: string

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

interface SessionRow {
  id: string
  task_id: string | null
  ended_at: string | null
  summary: string | null
  files_touched: string | null
}

describe('agent session recorder', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-agent-session-root-'))
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-agent-session-project-'))
    projectId = `agent-session-${Math.random().toString(36).slice(2, 10)}`
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

  it('records start and end metadata without raw transcript content', () => {
    recordAgentSessionStart({
      projectId,
      sessionId: 'session-1',
      directory: projectPath,
      goal: 'startup',
    })
    recordAgentSessionEnd({
      projectId,
      sessionId: 'session-1',
      directory: projectPath,
      taskId: 'task-1',
      goal: 'Fix attribution',
      tokensIn: 1200,
      tokensOut: 300,
      agent: 'claude',
      filesTouched: ['core/commands/product.ts'],
    })

    const row = prjctDb.get<SessionRow>(
      projectId,
      'SELECT id, task_id, ended_at, summary, files_touched FROM agent_sessions WHERE id = ?',
      'session-1'
    )

    expect(row?.id).toBe('session-1')
    expect(row?.task_id).toBe('task-1')
    expect(row?.ended_at).toBeTruthy()
    expect(row?.summary).toContain('agent=claude')
    expect(row?.summary).toContain('tokens_in=1200')
    expect(row?.summary).not.toContain('Fix attribution')
    expect(row?.files_touched).toContain('core/commands/product.ts')
  })
})
