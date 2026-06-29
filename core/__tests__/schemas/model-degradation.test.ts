/**
 * Rig sovereignty (harness pillar 5) — graceful model degradation.
 *
 * The brain is rented and can be throttled or pulled. `resolveAgentModel`
 * keeps the harness working on whatever tier is available: it reserves the
 * expensive tier for the role that needs it, and degrades to the nearest
 * still-capable option rather than failing when the preferred tier is gone.
 */

import { describe, expect, it } from 'bun:test'
import { type AgentModelTier, renderModelDirective, resolveAgentModel } from '../../schemas/model'

const set = (...tiers: AgentModelTier[]): ReadonlySet<AgentModelTier> => new Set(tiers)

describe('resolveAgentModel — graceful degradation', () => {
  it('keeps the preferred tier when it is available', () => {
    const r = resolveAgentModel('implementer', set('opus', 'sonnet', 'haiku'))
    expect(r.model).toBe('opus')
    expect(r.preferred).toBe('opus')
    expect(r.degraded).toBe(false)
    expect(r.effort).toBe('max') // effort is never lowered by degradation
  })

  it('degrades the implementer down by capability when opus is throttled', () => {
    const r = resolveAgentModel('implementer', set('sonnet', 'haiku'))
    expect(r.model).toBe('sonnet')
    expect(r.preferred).toBe('opus')
    expect(r.degraded).toBe(true)
    expect(r.effort).toBe('max')
  })

  it('degrades a reviewer cheaper-first (sonnet → haiku) before reaching for opus', () => {
    const r = resolveAgentModel('review', set('haiku', 'opus'))
    expect(r.model).toBe('haiku')
    expect(r.degraded).toBe(true)
  })

  it('lets the orchestrator step up when haiku is gone', () => {
    const r = resolveAgentModel('orchestrator', set('sonnet', 'opus'))
    expect(r.model).toBe('sonnet')
    expect(r.preferred).toBe('haiku')
    expect(r.degraded).toBe(true)
  })

  it('assumes the preferred tier when availability is unknown (no info → no degrade)', () => {
    expect(resolveAgentModel('implementer').model).toBe('opus')
    expect(resolveAgentModel('implementer', set()).degraded).toBe(false)
  })
})

describe('renderModelDirective — availability-aware dispatch prose', () => {
  it('is byte-identical to the original when no availability is passed', () => {
    expect(renderModelDirective('implementer')).toContain('model: "opus"')
    expect(renderModelDirective('implementer')).toContain('IMPLEMENTER')
    expect(renderModelDirective('review')).toContain('orchestration/review role')
  })

  it('degrades the implementer directive and points at verification when opus is gone', () => {
    const d = renderModelDirective('implementer', set('sonnet', 'haiku'))
    expect(d).toContain('model: "sonnet"')
    expect(d).toContain('IMPLEMENTER')
    expect(d).toContain('throttled')
    expect(d).toContain('verify:')
  })

  it('notes the degradation for review roles', () => {
    const d = renderModelDirective('review', set('haiku'))
    expect(d).toContain('model: "haiku"')
    expect(d).toContain('Preferred tier `sonnet`')
  })
})
