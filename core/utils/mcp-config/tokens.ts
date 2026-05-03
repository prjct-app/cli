/**
 * mcp-remote OAuth token validation, migration, and scanning.
 *
 * Tokens live in `~/.mcp-auth/mcp-remote-{version}/`. When the pinned
 * mcp-remote version bumps, the new daemon can't see tokens cached
 * under the old version dir — these helpers validate, migrate, and
 * clean those caches so the user doesn't have to re-auth on upgrade.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { systemDb } from '../../storage/system-database'
import type { TokenDirScan, TokenValidationResult } from '../../types/utils.js'

// Pin mcp-remote version to avoid token cache mismatch:
// mcp-remote stores OAuth tokens in ~/.mcp-auth/mcp-remote-{version}/
// If mcp.json and the manual auth step use different versions, Claude Code
// won't find the cached tokens and silently fails to authenticate.
export const MCP_REMOTE_VERSION = 'mcp-remote@0.1.38'

/** Extract the pinned mcp-remote version string (e.g. "0.1.38") */
export function getMcpRemoteVersion(): string {
  return MCP_REMOTE_VERSION.split('@')[1]
}

export const MCP_REMOTE_AUTH_COMMANDS: Record<'linear' | 'jira', string> = {
  linear: `npx -y ${MCP_REMOTE_VERSION} https://mcp.linear.app/mcp`,
  jira: `npx -y ${MCP_REMOTE_VERSION} https://mcp.atlassian.com/v1/mcp`,
}

/**
 * Validate token files in a directory — checks content, not just existence.
 * Looks for *_tokens.json files and verifies they contain valid OAuth data.
 */
export async function validateTokenFiles(dir: string): Promise<TokenValidationResult> {
  let files: string[]
  try {
    files = await fs.readdir(dir)
  } catch {
    return { valid: false, reason: 'directory not found' }
  }

  if (files.length === 0) return { valid: false, reason: 'directory empty' }

  const tokenFiles = files.filter((f) => f.endsWith('_tokens.json') || f.endsWith('.json'))
  if (tokenFiles.length === 0) return { valid: false, reason: 'no token files found' }

  for (const tokenFile of tokenFiles) {
    const filePath = path.join(dir, tokenFile)
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed.access_token || parsed.refresh_token) return { valid: true }
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

  const targetValid = await validateTokenFiles(targetDir)
  if (targetValid.valid) return { migrated: false, from: null, to: targetDir }

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
 * Remove invalid token files from a directory. Only cleans if tokens are
 * actually invalid.
 */
export async function cleanCorruptedTokens(dir: string): Promise<boolean> {
  const validation = await validateTokenFiles(dir)
  if (validation.valid) return false

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

  let cleaned = false

  // Step 1: Validate existing tokens (not just file existence)
  const validation = await validateTokenFiles(versionDir)

  if (validation.valid) {
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
