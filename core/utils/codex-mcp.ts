/**
 * Codex MCP wiring — ensures `~/.codex/config.toml` carries the prjct
 * MCP server entry so Codex sessions get the `prjct_*` tool surface.
 *
 * Codex has no JSON mcp config like Claude's `~/.claude/mcp.json`; its
 * MCP servers live as `[mcp_servers.<name>]` TOML tables in config.toml.
 * We manage our entry between `# prjct:mcp` comment markers (TOML has no
 * HTML comments) so re-runs replace our block and never touch user
 * content. If the user defined `[mcp_servers.prjct]` themselves (no
 * markers), we leave their config alone.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { MCPServerConfig } from '../types/utils.js'
import { MCP_SERVER_PRESETS } from './mcp-config'

const START_MARKER = '# prjct:mcp:start - managed by prjct, do not edit between markers'
const END_MARKER = '# prjct:mcp:end'

export function getCodexConfigTomlPath(): string {
  if (process.env.PRJCT_TEST_MODE === '1') {
    return path.join(os.tmpdir(), 'prjct-codex-test', 'config.toml')
  }
  return path.join(os.homedir(), '.codex', 'config.toml')
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function buildPrjctMcpTomlBlock(server: MCPServerConfig = MCP_SERVER_PRESETS.prjct): string {
  const args = (server.args ?? []).map(tomlString).join(', ')
  return [
    START_MARKER,
    '[mcp_servers.prjct]',
    `command = ${tomlString(server.command)}`,
    `args = [${args}]`,
    END_MARKER,
    '',
  ].join('\n')
}

/**
 * Idempotently install/refresh the prjct MCP server in Codex's config.toml.
 *
 * - No file → create it with just our block.
 * - File with our markers → replace the block in place.
 * - File with a user-managed `[mcp_servers.prjct]` (no markers) → untouched.
 * - Anything else → append our block.
 */
export async function ensureCodexMcpServer(
  configPath = getCodexConfigTomlPath()
): Promise<{ path: string; changed: boolean; skipped?: 'user-managed' }> {
  let existing = ''
  try {
    existing = await fs.readFile(configPath, 'utf-8')
  } catch {
    // Missing file — we'll create it.
  }

  const block = buildPrjctMcpTomlBlock()

  let next: string
  const startIdx = existing.indexOf(START_MARKER)
  const endIdx = existing.indexOf(END_MARKER)

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx)
    let after = existing.slice(endIdx + END_MARKER.length)
    if (after.startsWith('\n')) after = after.slice(1)
    next = before + block + after
  } else if (/^\s*\[mcp_servers\.prjct\]/m.test(existing)) {
    return { path: configPath, changed: false, skipped: 'user-managed' }
  } else if (existing.trim().length > 0) {
    next = `${existing.trimEnd()}\n\n${block}`
  } else {
    next = block
  }

  if (next === existing) {
    return { path: configPath, changed: false }
  }

  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, next, 'utf-8')
  return { path: configPath, changed: true }
}
