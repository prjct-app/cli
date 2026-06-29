/**
 * Emulated crew on a non-Claude rig (harness pillar 3).
 *
 * Claude gets native `.claude/agents/` subagents; every other rig has no
 * subagent tool, so `prjct crew install` writes an EMULATED protocol — one
 * agent plays leader/implementer/reviewer in fresh passes with the per-role
 * model from the policy. Provider is pinned for determinism.
 */

import { describe, expect, it } from 'bun:test'
import { buildEmulatedCrewProtocol, resolveDispatchMechanism } from '../../services/agent-dispatch'

describe('emulated crew protocol', () => {
  it('composes specialists (not a fixed trio) with the rig per-role models + checkpoints', async () => {
    const m = await resolveDispatchMechanism('gemini')
    const proto = buildEmulatedCrewProtocol(m, 'Tests must pass; no stray console.log.')

    expect(proto).toContain('emulated on gemini')
    expect(proto).toContain('composed per task, not a fixed trio')
    expect(proto).toContain('Leader')
    expect(proto).toContain('Implementer')
    // Review is a DYNAMIC specialist panel, not one generic reviewer.
    expect(proto).toContain('Review specialists')
    expect(proto).toContain('architecture') // floor lens
    for (const lens of ['security', 'data', 'performance', 'design', 'strategic']) {
      expect(proto).toContain(lens)
    }
    // Per-role rig models resolved from the policy via the bridge.
    expect(proto).toContain('2.5-pro') // implementer → frontier
    expect(proto).toContain('2.0-flash') // leader → fast
    expect(proto).toContain('2.5-flash') // reviewer → balanced
    expect(proto).toContain('Tests must pass') // checkpoints embedded
    expect(proto).toContain('prjct crew record-run')
    expect(proto).toContain('VERDICT: APPROVED')
  })

  it('hints when no checkpoints are set, and defers model choice on multi-model rigs', async () => {
    const m = await resolveDispatchMechanism('cursor')
    const proto = buildEmulatedCrewProtocol(m, '   ')
    expect(proto).toContain('No project checkpoints set')
    expect(proto).toContain('select your strongest model') // implementer on a multi-model rig
  })
})
