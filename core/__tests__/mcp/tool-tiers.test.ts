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

  it('unset and garbage default to the full surface', async () => {
    const all = await toolCount('all')
    expect(await toolCount(undefined)).toBe(all)
    expect(await toolCount('garbage')).toBe(all)
  })
})
