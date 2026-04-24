/**
 * Stop hook capture-checkpoint rule.
 *
 * Regression: the hook used to match only `memory.remember.%`, which
 * meant shipping a feature, capturing to inbox, or closing a task
 * still left the nag firing. Now ANY `memory.*` event that isn't
 * `memory.post_edit` counts as a checkpoint.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildStopContext } from '../../hooks/stop'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import prjctDb from '../../storage/database'

async function freshProject(): Promise<{ projectPath: string; projectId: string }> {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-stop-test-'))
  await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
  const projectId = `test-${Math.random().toString(36).slice(2, 10)}`
  await configManager.writeConfig(projectPath, {
    projectId,
    dataPath: path.join(projectPath, '.prjct-data'),
  })
  await pathManager.ensureProjectStructure(projectId)
  return { projectPath, projectId }
}

function insertEvent(projectId: string, type: string, offsetMinutes = 0): void {
  const ts = new Date(Date.now() - offsetMinutes * 60 * 1000).toISOString()
  prjctDb.run(projectId, "INSERT INTO events (type, data, timestamp) VALUES (?, '{}', ?)", type, ts)
}

describe('Stop hook capture checkpoint', () => {
  let projectPath: string
  let projectId: string

  beforeEach(async () => {
    ;({ projectPath, projectId } = await freshProject())
  })

  afterEach(async () => {
    if (projectPath) await fs.rm(projectPath, { recursive: true, force: true })
  })

  test('returns null when no edits fired', async () => {
    const context = await buildStopContext(projectPath)
    expect(context).toBeNull()
  })

  test('nags when edits fired and nothing durable landed', async () => {
    for (let i = 0; i < 5; i++) insertEvent(projectId, 'memory.post_edit')
    const context = await buildStopContext(projectPath)
    expect(context).not.toBeNull()
    expect(context).toContain('5 file edits')
    expect(context).toContain('capture checkpoint')
  })

  test('stays silent when a ship happened alongside edits', async () => {
    for (let i = 0; i < 20; i++) insertEvent(projectId, 'memory.post_edit')
    insertEvent(projectId, 'memory.feature_shipped')
    const context = await buildStopContext(projectPath)
    expect(context).toBeNull()
  })

  test('stays silent when a capture (remember.inbox) happened', async () => {
    for (let i = 0; i < 10; i++) insertEvent(projectId, 'memory.post_edit')
    insertEvent(projectId, 'memory.remember.inbox')
    const context = await buildStopContext(projectPath)
    expect(context).toBeNull()
  })

  test('stays silent when only a task.tagged event fired', async () => {
    for (let i = 0; i < 7; i++) insertEvent(projectId, 'memory.post_edit')
    insertEvent(projectId, 'memory.task.tagged')
    const context = await buildStopContext(projectPath)
    expect(context).toBeNull()
  })

  test('stays silent for status.changed', async () => {
    for (let i = 0; i < 3; i++) insertEvent(projectId, 'memory.post_edit')
    insertEvent(projectId, 'memory.status.changed')
    const context = await buildStopContext(projectPath)
    expect(context).toBeNull()
  })

  test('ignores checkpoints older than the 30-minute window', async () => {
    for (let i = 0; i < 4; i++) insertEvent(projectId, 'memory.post_edit', 5) // 5m ago
    insertEvent(projectId, 'memory.feature_shipped', 120) // 2h ago
    const context = await buildStopContext(projectPath)
    expect(context).not.toBeNull()
    expect(context).toContain('4 file edits')
  })
})
