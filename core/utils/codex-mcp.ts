/**
 * Codex config wiring — ensures `~/.codex/config.toml` carries the prjct
 * MCP server entry and a visible TUI status line.
 *
 * Codex has no JSON mcp config like Claude's `~/.claude/mcp.json`; its
 * MCP servers live as `[mcp_servers.<name>]` TOML tables in config.toml.
 * We manage our entry between `# prjct:mcp` comment markers (TOML has no
 * HTML comments) so re-runs replace our block and never touch user
 * content. If the user defined `[mcp_servers.prjct]` themselves (no
 * markers), we leave their config alone.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { resolveUserPath } from '../infrastructure/user-home'
import type { MCPServerConfig } from '../types/utils.js'
import { MCP_SERVER_PRESETS } from './mcp-config'

const START_MARKER = '# prjct:mcp:start - managed by prjct, do not edit between markers'
const END_MARKER = '# prjct:mcp:end'
const CODEX_STATUS_LINE_ITEMS = [
  'model-with-reasoning',
  'cwd',
  'git',
  'context-left',
  'five-hour-limit',
  'weekly-limit',
  'task-progress',
]

export function getCodexConfigTomlPath(): string {
  if (process.env.PRJCT_TEST_MODE === '1') {
    return path.join(resolveUserPath('.prjct-tests'), 'codex', 'config.toml')
  }
  return resolveUserPath('.codex', 'config.toml')
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

export function buildCodexStatusLineToml(): string {
  const items = CODEX_STATUS_LINE_ITEMS.map(tomlString).join(', ')
  return ['[tui]', `status_line = [${items}]`, ''].join('\n')
}

function hasCodexStatusLine(existing: string): boolean {
  return /^\s*(?:tui\.)?status_line\s*=/m.test(existing)
}

function ensureCodexStatusLineToml(existing: string): { toml: string; changed: boolean } {
  if (hasCodexStatusLine(existing)) return { toml: existing, changed: false }

  const items = CODEX_STATUS_LINE_ITEMS.map(tomlString).join(', ')
  const statusLine = `status_line = [${items}]\n`
  const tuiMatch = /^\s*\[tui\]\s*$/m.exec(existing)

  if (tuiMatch) {
    const insertAt = tuiMatch.index + tuiMatch[0].length
    const before = existing.slice(0, insertAt)
    let after = existing.slice(insertAt)
    if (after.startsWith('\n')) after = after.slice(1)
    return {
      toml: `${before}\n${statusLine}${after}`,
      changed: true,
    }
  }

  const block = buildCodexStatusLineToml()
  return {
    toml: existing.trim().length > 0 ? `${existing.trimEnd()}\n\n${block}` : block,
    changed: true,
  }
}

/**
 * Idempotently install/refresh the prjct MCP server and Codex TUI status line.
 *
 * - No file → create it with managed MCP + `[tui].status_line`.
 * - File with our markers → replace the MCP block in place.
 * - File with a user-managed `[mcp_servers.prjct]` (no markers) → preserve it.
 * - Existing `status_line` → preserve the user's selection.
 */
export async function ensureCodexMcpServer(configPath = getCodexConfigTomlPath()): Promise<{
  path: string
  changed: boolean
  skipped?: 'user-managed'
  statusLineChanged?: boolean
}> {
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

  let skipped: 'user-managed' | undefined

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx)
    let after = existing.slice(endIdx + END_MARKER.length)
    if (after.startsWith('\n')) after = after.slice(1)
    next = before + block + after
  } else if (/^\s*\[mcp_servers\.prjct\]/m.test(existing)) {
    next = existing
    skipped = 'user-managed'
  } else if (existing.trim().length > 0) {
    next = `${existing.trimEnd()}\n\n${block}`
  } else {
    next = block
  }

  const withStatusLine = ensureCodexStatusLineToml(next)
  next = withStatusLine.toml

  if (next === existing) {
    return { path: configPath, changed: false, skipped }
  }

  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, next, 'utf-8')
  return {
    path: configPath,
    changed: true,
    skipped,
    statusLineChanged: withStatusLine.changed,
  }
}
