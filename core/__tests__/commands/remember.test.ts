/**
 * `prjct remember` must not print success when the primary memory write fails.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PrimitiveCommands } from '../../commands/primitives'
import configManager from '../../infrastructure/config-manager'
import prjctDb from '../../storage/database'

async function freshProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-remember-test-'))
  await fs.mkdir(path.join(dir, '.prjct'), { recursive: true })
  const projectId = `test-${Math.random().toString(36).slice(2, 10)}`
  await configManager.writeConfig(dir, { projectId, dataPath: path.join(dir, '.prjct-data') })
  return dir
}

describe('remember verb', () => {
  let projectPath: string
  let cmd: PrimitiveCommands

  beforeEach(async () => {
    projectPath = await freshProject()
    cmd = new PrimitiveCommands()
  })

  afterEach(async () => {
    await fs.rm(projectPath, { recursive: true, force: true })
  })

  test('fails instead of reporting success when the memory event write fails', async () => {
    const appendSpy = spyOn(prjctDb, 'appendEvent').mockImplementation(() => {
      throw new Error('attempt to write a readonly database')
    })
    try {
      const result = await cmd.remember(
        'context "write failure must not be confirmed"',
        projectPath,
        { md: true }
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('attempt to write a readonly database')
    } finally {
      appendSpy.mockRestore()
    }
  })
})
