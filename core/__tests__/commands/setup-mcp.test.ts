import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setupMcpServers } from '../../commands/setup/mcp'

const TEST_MCP_PATH = path.join(os.tmpdir(), 'prjct-context7-test', 'mcp.json')
const ORIGINAL_TEST_MODE = process.env.PRJCT_TEST_MODE

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
})
