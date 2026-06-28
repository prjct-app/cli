/**
 * The static policy meets the live rig (harness pillar 5).
 *
 * Passing the provider explicitly makes getActiveProvider deterministic (no CLI
 * detection), so we can assert the bridge picks the right directive per rig.
 */

import { describe, expect, it } from 'bun:test'
import { renderActiveModelDirective } from '../../services/model-directive'

describe('renderActiveModelDirective — provider-correct on the live rig', () => {
  it('keeps the rich Claude directive on a Claude rig', async () => {
    const d = await renderActiveModelDirective('implementer', 'claude')
    expect(d).toContain('model: "opus"')
    expect(d).toContain('IMPLEMENTER')
  })

  it('emits the concrete model on a Gemini rig', async () => {
    const d = await renderActiveModelDirective('implementer', 'gemini')
    expect(d).toContain('2.5-pro')
    expect(d).toContain('gemini')
  })

  it('defers to the rig on a multi-model provider', async () => {
    const d = await renderActiveModelDirective('implementer', 'cursor')
    expect(d).toContain('select your strongest model')
    expect(d).toContain('cursor')
  })
})
