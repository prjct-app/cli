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
  it('plays the three roles with the rig per-role models + embeds checkpoints', async () => {
    const m = await resolveDispatchMechanism('gemini')
    const proto = buildEmulatedCrewProtocol(m, 'Tests must pass; no stray console.log.')

    expect(proto).toContain('emulated on gemini')
    expect(proto).toContain('Leader')
    expect(proto).toContain('Implementer')
    expect(proto).toContain('Reviewer')
    // Per-role rig models resolved from the policy via the bridge.
    expect(proto).toContain('2.5-pro') // implementer → frontier
    expect(proto).toContain('2.0-flash') // leader → fast
    expect(proto).toContain('2.5-flash') // reviewer → balanced
    // Checkpoints the reviewer applies are embedded.
    expect(proto).toContain('Tests must pass')
    // Persistence + record-run discipline carried over from the native crew.
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
