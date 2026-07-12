import { afterEach, describe, expect, it } from 'bun:test'

async function toolCount(tier: string | undefined): Promise<number> {
  if (tier === undefined) delete process.env.PRJCT_MCP_TOOLS
  else process.env.PRJCT_MCP_TOOLS = tier
  const { createServer } = await import('../../mcp/server')
  const server = createServer() as unknown as { _registeredTools?: Record<string, unknown> }
  return Object.keys(server._registeredTools ?? {}).length
}

afterEach(() => {
  delete process.env.PRJCT_MCP_TOOLS
})

describe('tiered MCP tool loading (PRJCT_MCP_TOOLS)', () => {
  it('core < standard < all — every registered tool costs schema tokens per session', async () => {
    const core = await toolCount('core')
    const standard = await toolCount('standard')
    const all = await toolCount('all')
    expect(core).toBeGreaterThan(0)
    expect(standard).toBeGreaterThan(core)
    expect(all).toBeGreaterThan(standard)
  })

  it('core stays lean (schema-tax budget)', async () => {
    const core = await toolCount('core')
    // mem×5 + project×5 = 10 after slim (typed/cost/signals/skills off-core)
    expect(core).toBeLessThanOrEqual(12)
    expect(core).toBeGreaterThanOrEqual(8)
  })

  it('unset and garbage default to core; all remains opt-in', async () => {
    const core = await toolCount('core')
    expect(await toolCount(undefined)).toBe(core)
    expect(await toolCount('garbage')).toBe(core)
    expect(await toolCount('all')).toBeGreaterThan(core)
  })
})
