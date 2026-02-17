import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getErrorMessage } from '../types/fs'

export interface MCPServerConfig {
  command: string
  args: string[]
  env?: Record<string, string>
  description?: string
}

interface MCPConfig {
  mcpServers?: Record<string, MCPServerConfig>
  [key: string]: unknown
}

// Pin mcp-remote version to avoid token cache mismatch:
// mcp-remote stores OAuth tokens in ~/.mcp-auth/mcp-remote-{version}/
// If mcp.json and the manual auth step use different versions, Claude Code
// won't find the cached tokens and silently fails to authenticate.
const MCP_REMOTE_VERSION = 'mcp-remote@0.1.38'

export const MCP_SERVER_PRESETS: Record<'linear' | 'jira', MCPServerConfig> = {
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

export const MCP_REMOTE_AUTH_COMMANDS: Record<'linear' | 'jira', string> = {
  linear: `npx -y ${MCP_REMOTE_VERSION} https://mcp.linear.app/mcp`,
  jira: `npx -y ${MCP_REMOTE_VERSION} https://mcp.atlassian.com/v1/mcp`,
}

export function getClaudeMcpConfigPath(): string {
  if (process.env.PRJCT_TEST_MODE === '1') {
    return path.join(os.tmpdir(), 'prjct-context7-test', 'mcp.json')
  }
  return path.join(os.homedir(), '.claude', 'mcp.json')
}

export interface ProviderMcpPath {
  provider: string
  configPath: string
  /** Gemini: write into existing settings.json; Claude: standalone mcp.json */
  mergeIntoExisting: boolean
}

/**
 * Returns MCP config paths for all installed AI provider CLIs.
 * Claude: ~/.claude/mcp.json
 * Gemini: ~/.gemini/settings.json (mcpServers key merged in)
 */
export async function getActiveMcpConfigPaths(): Promise<ProviderMcpPath[]> {
  // In test mode, only return the Claude test path
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

  // Claude Code — check ~/.claude/ exists
  const claudeDir = path.join(homeDir, '.claude')
  try {
    await fs.access(claudeDir)
    paths.push({
      provider: 'claude',
      configPath: path.join(claudeDir, 'mcp.json'),
      mergeIntoExisting: false,
    })
  } catch {
    /* not installed */
  }

  // Gemini CLI — check ~/.gemini/ exists
  const geminiDir = path.join(homeDir, '.gemini')
  try {
    await fs.access(geminiDir)
    paths.push({
      provider: 'gemini',
      configPath: path.join(geminiDir, 'settings.json'),
      mergeIntoExisting: true,
    })
  } catch {
    /* not installed */
  }

  return paths
}

/**
 * Upsert MCP server in ALL active providers.
 * Returns results per provider.
 */
export async function upsertMcpServerAll(
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
export async function hasMcpServerAny(serverName: string): Promise<{
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
 * Check if OAuth tokens exist for a provider in ~/.mcp-auth/
 * mcp-remote stores tokens in ~/.mcp-auth/mcp-remote-{version}/
 */
export async function checkOAuthTokens(provider: 'jira' | 'linear'): Promise<{
  ready: boolean
  tokenDir: string | null
  hint: string
}> {
  const version = MCP_REMOTE_VERSION.split('@')[1] // e.g. "0.1.38"
  const mcpAuthDir = path.join(os.homedir(), '.mcp-auth')
  const versionDir = path.join(mcpAuthDir, `mcp-remote-${version}`)

  try {
    const files = await fs.readdir(versionDir)
    if (files.length > 0) {
      return {
        ready: true,
        tokenDir: versionDir,
        hint: 'OAuth tokens found — restart your AI client.',
      }
    }
  } catch {
    /* directory doesn't exist */
  }

  // Check for legacy version dirs (different mcp-remote version)
  let legacyVersions: string[] = []
  try {
    const entries = await fs.readdir(mcpAuthDir)
    legacyVersions = entries.filter(
      (e) => e.startsWith('mcp-remote-') && e !== `mcp-remote-${version}`
    )
  } catch {
    /* ~/.mcp-auth doesn't exist */
  }

  const hint =
    legacyVersions.length > 0
      ? `OAuth tokens found for old version (${legacyVersions.join(', ')}). Re-run: ${MCP_REMOTE_AUTH_COMMANDS[provider]}`
      : `OAuth not completed. Run in a terminal: ${MCP_REMOTE_AUTH_COMMANDS[provider]}`

  return { ready: false, tokenDir: null, hint }
}

export async function readMcpConfig(configPath = getClaudeMcpConfigPath()): Promise<MCPConfig> {
  try {
    const raw = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(raw) as MCPConfig
  } catch (error) {
    const message = getErrorMessage(error).toLowerCase()
    if (message.includes('no such file') || message.includes('enoent')) {
      return {}
    }
    throw new Error(`Failed to read MCP config at ${configPath}: ${getErrorMessage(error)}`)
  }
}

export async function writeMcpConfig(
  config: MCPConfig,
  configPath = getClaudeMcpConfigPath()
): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
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
