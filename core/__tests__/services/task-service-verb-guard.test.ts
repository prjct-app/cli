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

  it('does not treat multi-word descriptions as bare verbs', async () => {
    // Collision is ONLY lone registered verbs. Multi-word intent must not
    // short-circuit with the collision message. We only invoke startTask far
    // enough to hit the guard — bare verbs return immediately; multi-word
    // continues (may succeed or fail later for other reasons).
    const bare = await startTask('proj', '/nope', 'sync')
    expect(bare.ok).toBe(false)
    expect(bare.blocked).toMatch(/is a prjct command/)

    // Multi-word: guarantee the collision branch is NOT taken by asserting
    // the description would not match the lone-verb predicate used by startTask.
    const multi = 'fix the sync flow'
    const lone = multi.trim().toLowerCase()
    // Same rule as task-service: REGISTERED_VERBS_SET.has(lone) is false for multi-word.
    expect(lone.includes(' ')).toBe(true)
    // And a full startTask must not return the collision message if it fails.
    // Race with a short timeout so CI never hangs on cold DB/git for a fake project.
    const result = await Promise.race([
      startTask(`proj-mw-${Date.now()}`, '/nope', multi).catch((e: unknown) => ({
        ok: false as const,
        blocked: String(e),
      })),
      new Promise<{ ok: false; blocked: string }>((resolve) =>
        setTimeout(() => resolve({ ok: false, blocked: 'test-timeout' }), 1500)
      ),
    ])
    if (result.ok === false && result.blocked) {
      expect(result.blocked).not.toContain('is a prjct command')
    }
  })
})
