import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { InstallCommands } from '../../commands/install'

const ORIGINAL_HOME = process.env.HOME
const ORIGINAL_TEST_MODE = process.env.PRJCT_TEST_MODE

describe('prjct install Codex surface', () => {
  let home: string
  let projectPath: string

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-install-codex-home-'))
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-install-codex-project-'))
    process.env.HOME = home
    delete process.env.PRJCT_TEST_MODE
    await fs.mkdir(path.join(home, '.codex'), { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true })
    await fs.rm(projectPath, { recursive: true, force: true })
    if (ORIGINAL_HOME === undefined) delete process.env.HOME
    else process.env.HOME = ORIGINAL_HOME
    if (ORIGINAL_TEST_MODE === undefined) delete process.env.PRJCT_TEST_MODE
    else process.env.PRJCT_TEST_MODE = ORIGINAL_TEST_MODE
  })

  test('writes Codex config.toml with the prjct status line', async () => {
    const cmd = new InstallCommands()
    const result = await cmd.install(null, projectPath, { md: true })

    expect(result.success).toBe(true)
    expect(result.codexConfig).toMatchObject({
      changed: true,
      statusLineChanged: true,
    })

    const config = await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf-8')
    expect(config).toContain('[mcp_servers.prjct]')
    expect(config).toContain('[tui]')
    expect(config).toContain(
      'status_line = ["model-with-reasoning", "cwd", "git", "context-left", "five-hour-limit", "weekly-limit", "task-progress"]'
    )
  })
})
