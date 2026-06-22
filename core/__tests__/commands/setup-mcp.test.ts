import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setupMcpServers } from '../../commands/setup/mcp'
import { buildContext7SmokePath } from '../../services/context7-service'

const TEST_MCP_PATH = path.join(os.tmpdir(), 'prjct-context7-test', 'mcp.json')
const TEST_HOME = path.join(os.tmpdir(), 'prjct-context7-test', 'home')
const ORIGINAL_TEST_MODE = process.env.PRJCT_TEST_MODE
const ORIGINAL_NVM_DIR = process.env.NVM_DIR
const ORIGINAL_FNM_DIR = process.env.FNM_DIR

describe('setup MCP defaults', () => {
  beforeEach(async () => {
    process.env.PRJCT_TEST_MODE = '1'
    await fs.rm(path.dirname(TEST_MCP_PATH), { recursive: true, force: true })
  })

  afterEach(() => {
    if (ORIGINAL_TEST_MODE === undefined) {
      delete process.env.PRJCT_TEST_MODE
    } else {
      process.env.PRJCT_TEST_MODE = ORIGINAL_TEST_MODE
    }
    if (ORIGINAL_NVM_DIR === undefined) {
      delete process.env.NVM_DIR
    } else {
      process.env.NVM_DIR = ORIGINAL_NVM_DIR
    }
    if (ORIGINAL_FNM_DIR === undefined) {
      delete process.env.FNM_DIR
    } else {
      process.env.FNM_DIR = ORIGINAL_FNM_DIR
    }
  })

  test('configures required prjct-managed MCPs by default', async () => {
    await setupMcpServers({ silent: true, verifyContext7: false })

    const raw = await fs.readFile(TEST_MCP_PATH, 'utf-8')
    const config = JSON.parse(raw) as {
      mcpServers?: Record<string, { command?: string; args?: string[] }>
    }

    expect(config.mcpServers?.context7?.command).toBe('npx')
    expect(config.mcpServers?.context7?.args).toContain('@upstash/context7-mcp@latest')
    expect(config.mcpServers?.prjct?.command).toBeTruthy()
    expect(config.mcpServers?.linear).toBeUndefined()
    expect(config.mcpServers?.jira).toBeUndefined()
  })

  test('Context7 smoke PATH augments daemon-minimal PATH with common npx locations', async () => {
    await fs.mkdir(path.join(TEST_HOME, '.nvm', 'versions', 'node', 'v24.0.0', 'bin'), {
      recursive: true,
    })
    await fs.mkdir(
      path.join(
        TEST_HOME,
        '.local',
        'share',
        'fnm',
        'node-versions',
        'v22.0.0',
        'installation',
        'bin'
      ),
      { recursive: true }
    )

    process.env.NVM_DIR = path.join(TEST_HOME, '.nvm')
    process.env.FNM_DIR = path.join(TEST_HOME, '.local', 'share', 'fnm')

    const smokePath = await buildContext7SmokePath('/usr/bin', TEST_HOME)
    const dirs = smokePath.split(path.delimiter)

    expect(dirs).toContain('/usr/bin')
    expect(dirs).toContain('/opt/homebrew/bin')
    expect(dirs).toContain('/usr/local/bin')
    expect(dirs).toContain(path.join(TEST_HOME, '.bun', 'bin'))
    expect(dirs).toContain(path.join(TEST_HOME, '.volta', 'bin'))
    expect(dirs).toContain(path.join(TEST_HOME, '.nvm', 'versions', 'node', 'v24.0.0', 'bin'))
    expect(dirs).toContain(
      path.join(
        TEST_HOME,
        '.local',
        'share',
        'fnm',
        'node-versions',
        'v22.0.0',
        'installation',
        'bin'
      )
    )
    expect(new Set(dirs).size).toBe(dirs.length)
  })

  test('repairs stale prjct MCP command instead of only checking presence', async () => {
    await fs.mkdir(path.dirname(TEST_MCP_PATH), { recursive: true })
    await fs.writeFile(
      TEST_MCP_PATH,
      JSON.stringify({
        mcpServers: {
          prjct: {
            command: 'npx',
            args: ['-y', 'prjct-cli', 'mcp'],
          },
        },
      }),
      'utf-8'
    )

    await setupMcpServers({ silent: true, verifyContext7: false })

    const raw = await fs.readFile(TEST_MCP_PATH, 'utf-8')
    const config = JSON.parse(raw) as {
      mcpServers?: Record<string, { command?: string; args?: string[] }>
    }

    expect(config.mcpServers?.prjct?.args).not.toEqual(['-y', 'prjct-cli', 'mcp'])
    expect(config.mcpServers?.prjct?.args?.join(' ')).toContain('mcp-server')
  })
})
