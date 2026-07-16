import { describe, expect, it } from 'bun:test'
import {
  formatHarnessSurfacesMarkdown,
  getHarnessSurface,
  listHarnessSurfaces,
} from '../../infrastructure/harness-surfaces'

describe('harness surfaces matrix', () => {
  it('covers benchmark-tier CLIs with hook + MCP wire status', () => {
    const ids = listHarnessSurfaces().map((s) => s.runtimeId)
    for (const id of [
      'claude',
      'codex',
      'gemini',
      'grok',
      'opencode',
      'cursor',
      'cline',
    ] as const) {
      expect(ids).toContain(id)
    }
  })

  it('documents Grok as native MCP+skills+plugin with hooks inherits-claude', () => {
    const grok = getHarnessSurface('grok')
    expect(grok).toBeDefined()
    expect(grok!.hooks.prjct).toBe('inherits-claude')
    expect(grok!.mcp.prjct).toBe('native')
    expect(grok!.skills.prjct).toBe('native')
    expect(grok!.plugins?.prjct).toBe('native')
    expect(grok!.legibility).toMatch(/native MCP/i)
  })

  it('documents Claude as fully native', () => {
    const claude = getHarnessSurface('claude')
    expect(claude!.hooks.prjct).toBe('native')
    expect(claude!.mcp.prjct).toBe('native')
    expect(claude!.hooks.events).toContain('SessionStart')
    expect(claude!.hooks.events).toContain('PreToolUse')
  })

  it('documents Codex MCP and hooks as native', () => {
    const codex = getHarnessSurface('codex')
    expect(codex!.mcp.prjct).toBe('native')
    expect(codex!.hooks.prjct).toBe('native')
  })

  it('documents Gemini MCP and hooks as native', () => {
    const gemini = getHarnessSurface('gemini')
    expect(gemini!.mcp.prjct).toBe('native')
    expect(gemini!.hooks.prjct).toBe('native')
  })

  it('documents Cursor hooks as native', () => {
    const cursor = getHarnessSurface('cursor')
    expect(cursor!.hooks.prjct).toBe('native')
  })

  it('formatHarnessSurfacesMarkdown is agent-legible', () => {
    const md = formatHarnessSurfacesMarkdown({ detail: true })
    expect(md).toContain('Harness surfaces')
    expect(md).toContain('Grok')
    expect(md).toContain('inherits-claude')
    expect(md).toContain('native')
  })
})
