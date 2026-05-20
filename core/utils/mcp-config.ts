import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getErrorMessage } from '../types/fs'
import type { MCPServerConfig, ProviderMcpPath } from '../types/utils.js'
import { dirExists, writeJson } from './file-helper'
import { checkOAuthTokens, MCP_REMOTE_VERSION, scanTokenDirectories } from './mcp-config/tokens'

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

/**
 * Returns MCP config paths for all installed AI provider CLIs.
 * Claude: ~/.claude/mcp.json
 * Gemini: ~/.gemini/settings.json (mcpServers key merged in)
 */
async function getActiveMcpConfigPaths(): Promise<ProviderMcpPath[]> {
  if (process.env.PRJCT_TEST_MODE === '1') {
    return [
      {
        provider: 'claude',
        configPath: getClaudeMcpConfigPath(),
        mergeIntoExisting: false,
      },
    ]
  }

  const homeDir = os.homedir()
  const paths: ProviderMcpPath[] = []

  const claudeDir = path.join(homeDir, '.claude')
  if (await dirExists(claudeDir)) {
    paths.push({
      provider: 'claude',
      configPath: path.join(claudeDir, 'mcp.json'),
      mergeIntoExisting: false,
    })
  }

  const geminiDir = path.join(homeDir, '.gemini')
  if (await dirExists(geminiDir)) {
    paths.push({
      provider: 'gemini',
      configPath: path.join(geminiDir, 'settings.json'),
      mergeIntoExisting: true,
    })
  }

  return paths
}

/**
 * Upsert MCP server in ALL active providers.
 * Returns results per provider.
 */
async function _upsertMcpServerAll(
  serverName: string,
  serverConfig: MCPServerConfig
): Promise<Array<{ provider: string; path: string; changed: boolean }>> {
  const providerPaths = await getActiveMcpConfigPaths()
  return Promise.all(
    providerPaths.map(async (p) => {
      const result = await upsertMcpServer(serverName, serverConfig, p.configPath)
      return { provider: p.provider, ...result }
    })
  )
}

/**
 * Check if MCP server is configured in ANY active provider.
 */
async function _hasMcpServerAny(serverName: string): Promise<{
  configured: boolean
  providers: Array<{ provider: string; configured: boolean; path: string }>
}> {
  const providerPaths = await getActiveMcpConfigPaths()
  const results = await Promise.all(
    providerPaths.map(async (p) => ({
      provider: p.provider,
      configured: await hasMcpServer(serverName, p.configPath),
      path: p.configPath,
    }))
  )
  return {
    configured: results.some((r) => r.configured),
    providers: results,
  }
}

/**
 * Validate mcp.json entry for a provider against the expected preset.
 * Auto-fixes if malformed by re-writing from preset.
 */
async function _validateMcpConfig(provider: 'jira' | 'linear'): Promise<{
  valid: boolean
  issues: string[]
  autoFixed: boolean
}> {
  const issues: string[] = []
  let autoFixed = false

  const providerPaths = await getActiveMcpConfigPaths()
  for (const p of providerPaths) {
    const config = await readMcpConfig(p.configPath)
    const entry = config.mcpServers?.[provider]

    if (!entry) {
      issues.push(`${p.provider}: no ${provider} entry in mcp.json`)
      continue
    }

    const preset = MCP_SERVER_PRESETS[provider]

    if (
      entry.command !== preset.command ||
      JSON.stringify(entry.args) !== JSON.stringify(preset.args)
    ) {
      issues.push(`${p.provider}: ${provider} config doesn't match preset (stale version?)`)

      const nextServers = { ...(config.mcpServers || {}) }
      nextServers[provider] = preset
      config.mcpServers = nextServers
      await writeMcpConfig(config, p.configPath)
      autoFixed = true
    }
  }

  return { valid: issues.length === 0, issues, autoFixed }
}

// Re-routed wrappers (keep underscore-prefixed names so any future callers
// or call-sites in this module continue to compile).
const _checkOAuthTokens = checkOAuthTokens
const _scanTokenDirectories = scanTokenDirectories

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

// Suppress unused warnings — these are reserved for future callers.
void _upsertMcpServerAll
void _hasMcpServerAny
void _validateMcpConfig
void _checkOAuthTokens
void _scanTokenDirectories
