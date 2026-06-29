/**
 * Provider-aware dispatch (harness pillars 3 + 5): the multi-agent
 * architecture runs on any rig — native subagents on Claude, emulated
 * fresh-context fan-out elsewhere, always with the policy's per-role model.
 * Provider is pinned for determinism (no CLI detection).
 */

import { describe, expect, it } from 'bun:test'
import { resolveDispatchMechanism } from '../../services/agent-dispatch'

describe('resolveDispatchMechanism', () => {
  it('uses native subagents + the Claude model on a Claude rig', async () => {
    const m = await resolveDispatchMechanism('claude')
    expect(m.native).toBe(true)
    expect(m.runLine(3)).toContain('via the Agent tool')
    expect(m.modelDirective('implementer')).toContain('model: "opus"')
  })

  it('emulates the fan-out + uses the rig model on a non-Claude rig', async () => {
    const m = await resolveDispatchMechanism('gemini')
    expect(m.native).toBe(false)
    expect(m.runLine(3)).toContain('EMULATE the fan-out')
    expect(m.runLine(1)).toContain('no native subagent tool')
    expect(m.modelDirective('implementer')).toContain('2.5-pro')
  })

  it('defers model selection to a multi-model rig', async () => {
    const m = await resolveDispatchMechanism('cursor')
    expect(m.native).toBe(false)
    expect(m.modelDirective('implementer')).toContain('select your strongest model')
  })
})
