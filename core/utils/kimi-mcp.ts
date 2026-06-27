/**
 * Kimi CLI MCP wiring — ensures `~/.kimi/mcp.json` carries the prjct (and
 * Context7) MCP server entries so Kimi agents get the `prjct_*` tools, not
 * just the AGENTS.md routing text.
 *
 * Unlike Codex (TOML tables in config.toml), Kimi stores MCP servers as a
 * standard `{ "mcpServers": { ... } }` JSON document — the same shape Claude
 * uses — so we reuse the JSON upsert helpers. Each server is upserted by
 * name, leaving any user-defined servers in the file untouched.
 */

import { resolveUserPath } from '../infrastructure/user-home'
import { MCP_SERVER_PRESETS, upsertMcpServer } from './mcp-config'

export function getKimiMcpConfigPath(): string {
  if (process.env.PRJCT_TEST_MODE === '1') {
    return resolveUserPath('.prjct-tests', 'kimi', 'mcp.json')
  }
  return resolveUserPath('.kimi', 'mcp.json')
}

/**
 * Idempotently install/refresh the prjct + Context7 MCP servers in Kimi's
 * `~/.kimi/mcp.json`. Returns whether the file changed so callers can report
 * "added" vs "already ready".
 */
export async function ensureKimiMcpServer(configPath = getKimiMcpConfigPath()): Promise<{
  path: string
  changed: boolean
}> {
  const context7 = await upsertMcpServer('context7', MCP_SERVER_PRESETS.context7, configPath)
  const prjct = await upsertMcpServer('prjct', MCP_SERVER_PRESETS.prjct, configPath)
  return { path: configPath, changed: context7.changed || prjct.changed }
}
