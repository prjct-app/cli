import { describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  type AgentRuntimeId,
  detectAgentRuntimes,
  getAgentRuntime,
  listAgentRuntimes,
} from '../../infrastructure/agent-runtime-registry'

describe('agent runtime registry', () => {
  it('keeps AGENTS.md as the universal baseline', () => {
    const universal = getAgentRuntime('agents-md')

    expect(universal.supports.agentsMd).toBe(true)
    expect(universal.contextFiles).toContain('AGENTS.md')
  })

  it('tracks modern coding-agent runtimes beyond the legacy provider list', () => {
    const ids = new Set(listAgentRuntimes().map((runtime) => runtime.id))

    const expectedRuntimes: AgentRuntimeId[] = [
      'opencode',
      'qwen-code',
      'kimi-cli',
      'grok',
      'goose',
      'aider',
      'cline',
      'roo-code',
      'continue',
      'kiro',
      'copilot',
      'devin',
      'jules',
      'zed',
      'amp',
    ]

    for (const id of expectedRuntimes) {
      expect(ids.has(id)).toBe(true)
    }
  })

  it('exposes a writable MCP target for Kimi CLI (~/.kimi/mcp.json)', () => {
    const kimi = getAgentRuntime('kimi-cli')

    expect(kimi.supports.mcp).toBe(true)
    const writable = (kimi.mcpTargets ?? []).filter((target) => target.writable)
    expect(writable.length).toBeGreaterThan(0)
    expect(writable[0]?.pathHint).toContain('.kimi/mcp.json')
  })

  it('registers xAI Grok Build as an AGENTS.md + MCP + skills capable CLI', () => {
    const grok = getAgentRuntime('grok')

    expect(grok.kind).toBe('cli')
    expect(grok.supports.agentsMd).toBe(true)
    expect(grok.supports.mcp).toBe(true)
    expect(grok.supports.skills).toBe(true)
    expect(grok.detectsBy?.commands).toContain('grok')
    // MCP schema unconfirmed from xAI docs — target is informational only, not auto-written.
    expect((grok.mcpTargets ?? []).every((target) => !target.writable)).toBe(true)
  })

  it('separates runtime compatibility from model/provider names', () => {
    const qwen = getAgentRuntime('qwen-code')

    expect(qwen.kind).toBe('model-runtime')
    expect(qwen.notes).toContain('model/provider choice')
    expect(qwen.supports.mcp).toBe(true)
  })

  it('detects project surfaces and reports support levels from the registry', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-runtime-registry-test-'))
    try {
      await fs.mkdir(path.join(dir, '.cursor'), { recursive: true })
      await fs.writeFile(path.join(dir, '.aider.conf.yml'), 'auto-commits: false\n')

      const statuses = await detectAgentRuntimes(dir)
      const byId = new Map(statuses.map((status) => [status.runtime.id, status]))

      expect(byId.get('agents-md')?.detected).toBe(true)
      expect(byId.get('mcp')?.supportLevel).toBe('manual')
      expect(byId.get('cursor')?.detectedSignals).toContain('.cursor/')
      expect(byId.get('cursor')?.supportLevel).toBe('good')
      expect(byId.get('aider')?.detectedSignals).toContain('.aider.conf.yml')
      expect(byId.get('aider')?.supportLevel).toBe('baseline')
      expect(byId.get('grok')?.supportLevel).toBe('good')
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  })
})
