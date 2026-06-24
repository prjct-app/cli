/**
 * Codex MCP wiring — `[mcp_servers.prjct]` in ~/.codex/config.toml.
 *
 * Pins the contract:
 *   1. No config.toml → created with managed MCP + status_line.
 *   2. Existing user config without our entry → block appended, user
 *      content byte-preserved.
 *   3. Existing managed block → replaced in place (upgrade path),
 *      idempotent when nothing changed.
 *   4. User-managed `[mcp_servers.prjct]` (no markers) → preserved;
 *      status_line is still added when absent.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  buildCodexStatusLineToml,
  buildPrjctMcpTomlBlock,
  ensureCodexMcpServer,
} from '../../utils/codex-mcp'

let dir: string
let configPath: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-codex-mcp-test-'))
  configPath = path.join(dir, 'config.toml')
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
})

describe('ensureCodexMcpServer', () => {
  it('creates config.toml with the prjct server when missing', async () => {
    const r = await ensureCodexMcpServer(configPath)
    expect(r.changed).toBe(true)
    const body = await fs.readFile(configPath, 'utf-8')
    expect(body).toContain('[mcp_servers.prjct]')
    expect(body).toContain('# prjct:mcp:start')
    expect(body).toContain('# prjct:mcp:end')
    expect(body).toContain('[tui]')
    expect(body).toContain('status_line = ["model-with-reasoning", "cwd", "git", "task-progress"]')
    expect(body).toMatch(/command = "/)
  })

  it('appends to an existing config without touching user content', async () => {
    const user = '[projects."/Users/x/app"]\ntrust_level = "trusted"\n'
    await fs.writeFile(configPath, user, 'utf-8')

    const r = await ensureCodexMcpServer(configPath)
    expect(r.changed).toBe(true)
    const body = await fs.readFile(configPath, 'utf-8')
    expect(body).toContain('trust_level = "trusted"')
    expect(body.indexOf('[projects.')).toBeLessThan(body.indexOf('[mcp_servers.prjct]'))
    expect(body.indexOf('[mcp_servers.prjct]')).toBeLessThan(body.indexOf('[tui]'))
  })

  it('replaces a stale managed block in place', async () => {
    await ensureCodexMcpServer(configPath)
    const before = await fs.readFile(configPath, 'utf-8')
    const stale = before.replace(/command = "[^"]*"/, 'command = "old-binary"')
    await fs.writeFile(configPath, stale, 'utf-8')

    const r = await ensureCodexMcpServer(configPath)
    expect(r.changed).toBe(true)
    const after = await fs.readFile(configPath, 'utf-8')
    expect(after).not.toContain('old-binary')
    // Exactly one managed block — replacement, not accumulation.
    expect(after.split('[mcp_servers.prjct]').length - 1).toBe(1)
  })

  it('is idempotent — second run reports unchanged', async () => {
    await ensureCodexMcpServer(configPath)
    const first = await fs.readFile(configPath, 'utf-8')
    const r = await ensureCodexMcpServer(configPath)
    expect(r.changed).toBe(false)
    expect(await fs.readFile(configPath, 'utf-8')).toBe(first)
  })

  it('preserves a user-managed [mcp_servers.prjct] entry while adding status_line', async () => {
    const user = '[mcp_servers.prjct]\ncommand = "my-custom-wrapper"\nargs = []\n'
    await fs.writeFile(configPath, user, 'utf-8')

    const r = await ensureCodexMcpServer(configPath)
    expect(r.changed).toBe(true)
    expect(r.skipped).toBe('user-managed')
    expect(r.statusLineChanged).toBe(true)
    const body = await fs.readFile(configPath, 'utf-8')
    expect(body).toContain('command = "my-custom-wrapper"')
    expect(body).toContain('status_line = ["model-with-reasoning", "cwd", "git", "task-progress"]')
  })

  it('does not override an existing Codex status_line', async () => {
    const user = '[tui]\nstatus_line = ["model"]\n'
    await fs.writeFile(configPath, user, 'utf-8')

    const r = await ensureCodexMcpServer(configPath)
    expect(r.changed).toBe(true)
    expect(r.statusLineChanged).toBe(false)
    const body = await fs.readFile(configPath, 'utf-8')
    expect(body).toContain('status_line = ["model"]')
    expect(body).not.toContain('task-progress')
    expect(body).toContain('[mcp_servers.prjct]')
  })

  it('inserts status_line into an existing [tui] table', async () => {
    await fs.writeFile(configPath, '[tui]\nraw_output_mode = true\n', 'utf-8')

    const r = await ensureCodexMcpServer(configPath)
    expect(r.statusLineChanged).toBe(true)
    const body = await fs.readFile(configPath, 'utf-8')
    expect(body).toContain(
      '[tui]\nstatus_line = ["model-with-reasoning", "cwd", "git", "task-progress"]\nraw_output_mode = true'
    )
  })
})

describe('buildCodexStatusLineToml', () => {
  it('builds the Codex TUI status_line table', () => {
    expect(buildCodexStatusLineToml()).toBe(
      '[tui]\nstatus_line = ["model-with-reasoning", "cwd", "git", "task-progress"]\n'
    )
  })
})

describe('buildPrjctMcpTomlBlock', () => {
  it('escapes TOML string values', () => {
    const block = buildPrjctMcpTomlBlock({
      command: 'C:\\node "x"',
      args: ['a"b'],
      description: 'ignored',
    })
    expect(block).toContain('command = "C:\\\\node \\"x\\""')
    expect(block).toContain('args = ["a\\"b"]')
    // description is a Claude mcp.json concept — Codex TOML must not get it.
    expect(block).not.toContain('description')
  })
})
