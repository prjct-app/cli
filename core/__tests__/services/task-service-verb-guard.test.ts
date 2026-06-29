/**
 * Verb-collision guard — agents on non-Claude harnesses (Codex) wrap a bare
 * CLI verb as a work intent (`prjct work "sync"`). startTask must reject a lone
 * registered verb BEFORE any state mutation and point at the real command.
 */

import { describe, expect, it } from 'bun:test'
import { startTask } from '../../services/task-service'

describe('startTask verb-collision guard', () => {
  it('rejects a bare registered verb and suggests the real command', async () => {
    const r = await startTask('proj', '/nope', 'sync')
    expect(r.ok).toBe(false)
    expect(r.blocked).toContain('prjct sync')
  })

  it('rejects regardless of casing/whitespace', async () => {
    const r = await startTask('proj', '/nope', '  Ship  ')
    expect(r.ok).toBe(false)
    expect(r.blocked).toContain('prjct ship')
  })

  it('does not block a real multi-word task description', async () => {
    // Reaches past the guard; fails later on the missing project, NOT on the
    // collision guard — so the message must not be the verb-collision one.
    const r = await startTask('proj', '/nope', 'fix the sync flow').catch((e) => ({
      ok: false as const,
      blocked: String(e),
    }))
    if (r.ok === false && r.blocked) {
      expect(r.blocked).not.toContain('is a prjct command')
    }
  })
})
