import { describe, expect, it } from 'bun:test'
import {
  type AgentRuntimeId,
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

  it('separates runtime compatibility from model/provider names', () => {
    const qwen = getAgentRuntime('qwen-code')

    expect(qwen.kind).toBe('model-runtime')
    expect(qwen.notes).toContain('model/provider choice')
    expect(qwen.supports.mcp).toBe(true)
  })
})
