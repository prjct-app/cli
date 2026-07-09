/**
 * Land auto-synthesis — pure content builder + shape contract.
 */

import { describe, expect, test } from 'bun:test'
import { buildLandHandoffContent } from '../../services/land-synthesis'

describe('land-synthesis — buildLandHandoffContent', () => {
  test('returns null when there is nothing durable to hand off', () => {
    const out = buildLandHandoffContent({
      projectId: 'no-such-project-land-test',
      projectPath: '/tmp/does-not-exist-land-synth',
      cycleDescription: null,
    })
    // no cycle, no journal table hit, no git, no autos
    expect(out).toBeNull()
  })

  test('synthesizes dense living-context fields from an open cycle alone', () => {
    const out = buildLandHandoffContent({
      projectId: 'no-such-project-land-test',
      projectPath: '/tmp/does-not-exist-land-synth',
      cycleDescription: 'fix release engines so npm publish works',
      author: 'test',
      model: 'test-model',
      tokensIn: 100,
      tokensOut: 50,
    })
    expect(out).not.toBeNull()
    expect(out!).toContain('Session close:')
    expect(out!).toContain('Context synthesis:')
    expect(out!).toContain('What happened:')
    expect(out!).toContain('Next implication:')
    expect(out!).toContain('source=land-auto')
    expect(out!).toContain('topic=session-close')
    expect(out!).toContain('fix release engines')
    expect(out!).toContain('Token usage: in=100 out=50')
    expect(out!).toContain('Model: test-model')
    // Dense hand-off: never spam empty placeholders.
    expect(out!).not.toContain('Sentiment: unknown')
    expect(out!).not.toContain('Related files: unknown')
    // Must not instruct the agent to run remember — we already did the hand-off.
    expect(out!).not.toContain('prjct remember context')
  })

  test('mentions open-cycle next step when a cycle is present', () => {
    const out = buildLandHandoffContent({
      projectId: 'no-such-project-land-test',
      projectPath: '/tmp/does-not-exist-land-synth',
      cycleDescription: 'implement land auto-synthesis',
    })
    expect(out).toContain('status done')
  })
})
