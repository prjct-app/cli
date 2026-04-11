import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { systemDb } from '../storage/system-database'
import { getErrorMessage } from '../types/fs'
import type {
  MCPServerConfig,
  ProviderMcpPath,
  TokenDirScan,
  TokenValidationResult,
} from '../types/utils.js'
import { dirExists, writeJson } from './file-helper'

interface MCPConfig {
  mcpServers?: Record<string, MCPServerConfig>
  [key: string]: unknown
}

// Pin mcp-remote version to avoid token cache mismatch:
// mcp-remote stores OAuth tokens in ~/.mcp-auth/mcp-remote-{version}/
// If mcp.json and the manual auth step use different versions, Claude Code
// won't find the cached tokens and silently fails to authenticate.
const MCP_REMOTE_VERSION = 'mcp-remote@0.1.38'

/**
 * Get the prjct MCP server config, resolving the path from the installed package.
 */
function getPrjctMcpConfig(): MCPServerConfig {
  try {
    const pkgDir = path.dirname(require.resolve('prjct-cli/package.json'))
    return {
      command: 'node',
      args: [path.join(pkgDir, 'dist', 'mcp', 'server.mjs')],
      description: 'prjct data layer (memories, analysis, files, workflows)',
    }
  } catch {
    // Fallback: use global npx
    return {
      command: 'npx',
      args: ['-y', 'prjct-cli', 'mcp'],
      description: 'prjct data layer (memories, analysis, files, workflows)',
    }
  }
}

export const MCP_SERVER_PRESETS: Record<'linear' | 'jira' | 'prjct', MCPServerConfig> = {
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

export const MCP_REMOTE_AUTH_COMMANDS: Record<'linear' | 'jira', string> = {
  linear: `npx -y ${MCP_REMOTE_VERSION} https://mcp.linear.app/mcp`,
  jira: `npx -y ${MCP_REMOTE_VERSION} https://mcp.atlassian.com/v1/mcp`,
}

/** Extract the pinned mcp-remote version string (e.g. "0.1.38") */
export function getMcpRemoteVersion(): string {
  return MCP_REMOTE_VERSION.split('@')[1]
}

export function getClaudeMcpConfigPath(): string {
  if (process.env.PRJCT_TEST_MODE === '1') {
    return path.join(os.tmpdir(), 'prjct-context7-test', 'mcp.json')
  }
  return path.join(os.homedir(), '.claude', 'mcp.json')
}

// ProviderMcpPath type moved to core/types/utils.ts

/**
 * Returns MCP config paths for all installed AI provider CLIs.
 * Claude: ~/.claude/mcp.json
 * Gemini: ~/.gemini/settings.json (mcpServers key merged in)
 */
async function getActiveMcpConfigPaths(): Promise<ProviderMcpPath[]> {
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
  if (await dirExists(claudeDir)) {
    paths.push({
      provider: 'claude',
      configPath: path.join(claudeDir, 'mcp.json'),
      mergeIntoExisting: false,
    })
  }

  // Gemini CLI — check ~/.gemini/ exists
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

// =============================================================================
// Token Validation & Migration
// =============================================================================

// TokenValidationResult type moved to core/types/utils.ts

/**
 * Validate token files in a directory — checks content, not just existence.
 * Looks for *_tokens.json files and verifies they contain valid OAuth data.
 */
async function validateTokenFiles(dir: string): Promise<TokenValidationResult> {
  let files: string[]
  try {
    files = await fs.readdir(dir)
  } catch {
    return { valid: false, reason: 'directory not found' }
  }

  if (files.length === 0) {
    return { valid: false, reason: 'directory empty' }
  }

  const tokenFiles = files.filter((f) => f.endsWith('_tokens.json') || f.endsWith('.json'))
  if (tokenFiles.length === 0) {
    return { valid: false, reason: 'no token files found' }
  }

  for (const tokenFile of tokenFiles) {
    const filePath = path.join(dir, tokenFile)
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw)

      // Token files must have access_token or refresh_token
      if (parsed.access_token || parsed.refresh_token) {
        return { valid: true }
      }
    } catch {
      return { valid: false, reason: `corrupt JSON in ${tokenFile}` }
    }
  }

  return { valid: false, reason: 'no valid tokens (missing access_token/refresh_token)' }
}

/**
 * Migrate OAuth tokens from legacy mcp-remote version directories.
 * Copies valid tokens from the highest legacy version to the current version dir.
 */
export async function migrateOAuthTokens(): Promise<{
  migrated: boolean
  from: string | null
  to: string
}> {
  const version = getMcpRemoteVersion()
  const mcpAuthDir = path.join(os.homedir(), '.mcp-auth')
  const targetDir = path.join(mcpAuthDir, `mcp-remote-${version}`)

  // If target already has valid tokens, skip migration
  const targetValid = await validateTokenFiles(targetDir)
  if (targetValid.valid) {
    return { migrated: false, from: null, to: targetDir }
  }

  // Find legacy dirs, sort by version (highest first)
  let entries: string[]
  try {
    entries = await fs.readdir(mcpAuthDir)
  } catch {
    return { migrated: false, from: null, to: targetDir }
  }

  const legacyDirs = entries
    .filter((e) => e.startsWith('mcp-remote-') && e !== `mcp-remote-${version}`)
    .sort()
    .reverse()

  for (const legacyDir of legacyDirs) {
    const legacyPath = path.join(mcpAuthDir, legacyDir)
    const validation = await validateTokenFiles(legacyPath)

    if (validation.valid) {
      // Copy all files from legacy to target
      await fs.mkdir(targetDir, { recursive: true })
      const files = await fs.readdir(legacyPath)
      for (const file of files) {
        await fs.copyFile(path.join(legacyPath, file), path.join(targetDir, file))
      }
      return { migrated: true, from: legacyPath, to: targetDir }
    }
  }

  return { migrated: false, from: null, to: targetDir }
}

/**
 * Remove invalid token files from a directory.
 * Only cleans if tokens are actually invalid.
 */
export async function cleanCorruptedTokens(dir: string): Promise<boolean> {
  const validation = await validateTokenFiles(dir)
  if (validation.valid) return false

  // If directory exists but tokens are invalid, remove all files + directory
  try {
    const files = await fs.readdir(dir)
    for (const file of files) {
      await fs.unlink(path.join(dir, file))
    }
    await fs.rmdir(dir)
    return true
  } catch {
    return false
  }
}

/**
 * Validate mcp.json entry for a provider against the expected preset.
 * Auto-fixes if malformed by re-writing from preset.
 */
export async function validateMcpConfig(provider: 'jira' | 'linear'): Promise<{
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

    // Check command and args match the preset
    if (
      entry.command !== preset.command ||
      JSON.stringify(entry.args) !== JSON.stringify(preset.args)
    ) {
      issues.push(`${p.provider}: ${provider} config doesn't match preset (stale version?)`)

      // Auto-fix by re-writing from preset
      const nextServers = { ...(config.mcpServers || {}) }
      nextServers[provider] = preset
      config.mcpServers = nextServers
      await writeMcpConfig(config, p.configPath)
      autoFixed = true
    }
  }

  return { valid: issues.length === 0, issues, autoFixed }
}

/**
 * Check if OAuth tokens exist AND are valid for a provider.
 * Validates token content, auto-migrates from legacy dirs, cleans corrupted files,
 * and writes health status to system DB.
 */
export async function checkOAuthTokens(provider: 'jira' | 'linear'): Promise<{
  ready: boolean
  tokenDir: string | null
  hint: string
  validated: boolean
  migrated: boolean
  cleaned: boolean
}> {
  const version = getMcpRemoteVersion()
  const mcpAuthDir = path.join(os.homedir(), '.mcp-auth')
  const versionDir = path.join(mcpAuthDir, `mcp-remote-${version}`)

  let _migrated = false
  let cleaned = false

  // Step 1: Validate existing tokens (not just file existence)
  const validation = await validateTokenFiles(versionDir)

  if (validation.valid) {
    // Tokens exist and are structurally valid
    systemDb.setMcpHealth(provider, {
      status: 'healthy',
      tokenVersion: version,
      oauthValid: true,
    })
    return {
      ready: true,
      tokenDir: versionDir,
      hint: 'OAuth tokens verified — restart your AI client.',
      validated: true,
      migrated: false,
      cleaned: false,
    }
  }

  // Step 2: If tokens exist but are invalid, clean them
  if (
    validation.reason &&
    validation.reason !== 'directory not found' &&
    validation.reason !== 'directory empty'
  ) {
    cleaned = await cleanCorruptedTokens(versionDir)
  }

  // Step 3: Attempt migration from legacy version dirs
  const migration = await migrateOAuthTokens()
  if (migration.migrated) {
    _migrated = true
    systemDb.setMcpHealth(provider, {
      status: 'healthy',
      tokenVersion: version,
      oauthValid: true,
    })
    return {
      ready: true,
      tokenDir: versionDir,
      hint: `Tokens migrated from ${path.basename(migration.from!)} — restart your AI client.`,
      validated: true,
      migrated: true,
      cleaned,
    }
  }

  // Step 4: Check for legacy dirs (can't migrate — they're invalid too)
  let legacyVersions: string[] = []
  try {
    const entries = await fs.readdir(mcpAuthDir)
    legacyVersions = entries.filter(
      (e) => e.startsWith('mcp-remote-') && e !== `mcp-remote-${version}`
    )
  } catch {
    /* ~/.mcp-auth doesn't exist */
  }

  const hint = cleaned
    ? `Previous tokens were invalid and cleaned. Run in a terminal: ${MCP_REMOTE_AUTH_COMMANDS[provider]}`
    : legacyVersions.length > 0
      ? `Legacy tokens found (${legacyVersions.join(', ')}) but invalid. Run: ${MCP_REMOTE_AUTH_COMMANDS[provider]}`
      : `OAuth not completed. Run in a terminal: ${MCP_REMOTE_AUTH_COMMANDS[provider]}`

  systemDb.setMcpHealth(provider, {
    status: 'unhealthy',
    lastError: hint,
    tokenVersion: version,
    oauthValid: false,
  })

  return {
    ready: false,
    tokenDir: null,
    hint,
    validated: false,
    migrated: false,
    cleaned,
  }
}

// =============================================================================
// Token Directory Scanning
// =============================================================================

// TokenDirScan type moved to core/types/utils.ts

/**
 * Scan ALL ~/.mcp-auth/mcp-remote-* directories and return a full inventory.
 * Used by the `verify` command to give users a complete picture of token state.
 */
export async function scanTokenDirectories(): Promise<{
  expectedVersion: string
  dirs: TokenDirScan[]
}> {
  const expectedVersion = getMcpRemoteVersion()
  const mcpAuthDir = path.join(os.homedir(), '.mcp-auth')
  const dirs: TokenDirScan[] = []

  let entries: string[]
  try {
    entries = await fs.readdir(mcpAuthDir)
  } catch {
    return { expectedVersion, dirs }
  }

  const mcpRemoteDirs = entries.filter((e) => e.startsWith('mcp-remote-')).sort()

  for (const dirName of mcpRemoteDirs) {
    const dirPath = path.join(mcpAuthDir, dirName)
    const version = dirName.replace('mcp-remote-', '')
    const isCurrent = version === expectedVersion

    let files: string[] = []
    try {
      const stat = await fs.stat(dirPath)
      if (!stat.isDirectory()) continue
      files = await fs.readdir(dirPath)
    } catch {
      continue
    }

    const tokenFile = files.find((f) => f.endsWith('_tokens.json')) ?? null
    let valid = false
    let reason: string | undefined
    let hasAccessToken = false
    let hasRefreshToken = false
    let expiresIn: number | undefined

    if (!tokenFile) {
      const jsonFiles = files.filter((f) => f.endsWith('.json'))
      if (jsonFiles.length === 0) {
        reason = 'no token files found'
      } else {
        // Check json files for token content
        for (const jf of jsonFiles) {
          try {
            const raw = await fs.readFile(path.join(dirPath, jf), 'utf-8')
            const parsed = JSON.parse(raw)
            if (parsed.access_token) hasAccessToken = true
            if (parsed.refresh_token) hasRefreshToken = true
            if (parsed.expires_in) expiresIn = parsed.expires_in
          } catch {
            reason = `corrupt JSON in ${jf}`
          }
        }
        valid = hasAccessToken || hasRefreshToken
        if (!valid && !reason) reason = 'no valid tokens (missing access_token/refresh_token)'
      }
    } else {
      try {
        const raw = await fs.readFile(path.join(dirPath, tokenFile), 'utf-8')
        const parsed = JSON.parse(raw)
        hasAccessToken = Boolean(parsed.access_token)
        hasRefreshToken = Boolean(parsed.refresh_token)
        if (parsed.expires_in) expiresIn = parsed.expires_in
        valid = hasAccessToken || hasRefreshToken
        if (!valid) reason = 'no valid tokens (missing access_token/refresh_token)'
      } catch {
        reason = `corrupt JSON in ${tokenFile}`
      }
    }

    dirs.push({
      version,
      path: dirPath,
      isCurrent,
      files,
      tokenFile,
      valid,
      reason,
      hasAccessToken,
      hasRefreshToken,
      expiresIn,
    })
  }

  return { expectedVersion, dirs }
}

async function readMcpConfig(configPath = getClaudeMcpConfigPath()): Promise<MCPConfig> {
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
