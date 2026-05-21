import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getErrorMessage } from '../types/fs'
import type { MCPServerConfig } from '../types/utils.js'
import { writeJson } from './file-helper'
import { MCP_REMOTE_VERSION } from './mcp-config/tokens'

interface MCPConfig {
  mcpServers?: Record<string, MCPServerConfig>
  [key: string]: unknown
}

/**
 * Get the prjct MCP server config, resolving the path from the installed package.
 */
function getPrjctMcpConfig(): MCPServerConfig {
  try {
    const pkgDir = path.dirname(require.resolve('prjct-cli/package.json'))
    return {
      command: 'node',
      args: [path.join(pkgDir, 'dist', 'mcp', 'server.mjs')],
      description:
        'prjct: Spec-Driven Development + project memory. When the user describes work with goals or stakes attached, call prjct_spec_create FIRST, then prjct_spec_audit (parallel reviewers), then implement, then prjct_spec_ship. Skip the spec for routine work (single-file fix, doc tweak, capture). Recognize intent in any language; never make the user type prjct commands.',
    }
  } catch {
    return {
      command: 'npx',
      args: ['-y', 'prjct-cli', 'mcp'],
      description:
        'prjct: Spec-Driven Development + project memory. When the user describes work with goals or stakes attached, call prjct_spec_create FIRST, then prjct_spec_audit (parallel reviewers), then implement, then prjct_spec_ship. Skip the spec for routine work (single-file fix, doc tweak, capture). Recognize intent in any language; never make the user type prjct commands.',
    }
  }
}

export const MCP_SERVER_PRESETS: Record<'context7' | 'linear' | 'jira' | 'prjct', MCPServerConfig> =
  {
    context7: {
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp@latest'],
      description: 'Library documentation lookup',
    },
    prjct: getPrjctMcpConfig(),
    linear: {
      command: 'npx',
      args: ['-y', MCP_REMOTE_VERSION, 'https://mcp.linear.app/mcp'],
      description: 'Linear MCP server (OAuth)',
    },
    jira: {
      command: 'npx',
      args: ['-y', MCP_REMOTE_VERSION, 'https://mcp.atlassian.com/v1/mcp'],
      description: 'Atlassian MCP server for Jira (OAuth)',
    },
  }

export function getClaudeMcpConfigPath(): string {
  if (process.env.PRJCT_TEST_MODE === '1') {
    return path.join(os.tmpdir(), 'prjct-context7-test', 'mcp.json')
  }
  return path.join(os.homedir(), '.claude', 'mcp.json')
}

async function readMcpConfig(configPath = getClaudeMcpConfigPath()): Promise<MCPConfig> {
  try {
    const raw = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(raw) as MCPConfig
  } catch (error) {
    const message = getErrorMessage(error).toLowerCase()
    if (message.includes('no such file') || message.includes('enoent')) return {}
    throw new Error(`Failed to read MCP config at ${configPath}: ${getErrorMessage(error)}`)
  }
}

async function writeMcpConfig(
  config: MCPConfig,
  configPath = getClaudeMcpConfigPath()
): Promise<void> {
  await writeJson(configPath, config)
}

export async function upsertMcpServer(
  serverName: string,
  serverConfig: MCPServerConfig,
  configPath = getClaudeMcpConfigPath()
): Promise<{ path: string; changed: boolean }> {
  const config = await readMcpConfig(configPath)
  const nextServers = { ...(config.mcpServers || {}) }
  const previous = nextServers[serverName]
  nextServers[serverName] = serverConfig
  config.mcpServers = nextServers

  const changed = JSON.stringify(previous) !== JSON.stringify(serverConfig)
  await writeMcpConfig(config, configPath)

  return { path: configPath, changed }
}

export async function hasMcpServer(
  serverName: string,
  configPath = getClaudeMcpConfigPath()
): Promise<boolean> {
  const config = await readMcpConfig(configPath)
  return Boolean(config.mcpServers?.[serverName])
}
