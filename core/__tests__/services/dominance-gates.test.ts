/**
 * Dominance gates vs gentle-ai / open-GSD — unit pins for discuss-lock,
 * context pressure, nyquist-lite, package legitimacy (pure logic).
 */

import { describe, expect, it } from 'bun:test'
import { contextPressureVerdict } from '../../services/context-pressure'
import { discussLockVerdict } from '../../services/discuss-lock'
import { assessAcceptanceCriteria, isVerifiableAcceptance } from '../../services/nyquist-lite'

describe('discuss-lock (GSD discuss-before-plan, code-enforced)', () => {
  it('never blocks when sdd is off', () => {
    const v = discussLockVerdict({
      sddMode: 'off',
      harnessLevel: 'H3',
      hasSpecId: false,
    })
    expect(v.blocked).toBe(false)
  })

  it('blocks H2 under advisory without a reviewed spec', () => {
    const v = discussLockVerdict({
      sddMode: 'advisory',
      harnessLevel: 'H2',
      hasSpecId: false,
    })
    expect(v.blocked).toBe(true)
    expect(v.reason).toBe('discuss-h2')
    expect(v.message).toMatch(/Discuss-lock/i)
  })

  it('does not block H1 under advisory without spec', () => {
    const v = discussLockVerdict({
      sddMode: 'advisory',
      harnessLevel: 'H1',
      hasSpecId: false,
    })
    expect(v.blocked).toBe(false)
  })

  it('blocks draft specs under strict', () => {
    const v = discussLockVerdict({
      sddMode: 'strict',
      harnessLevel: 'H0',
      hasSpecId: true,
      specStatus: 'draft',
    })
    expect(v.blocked).toBe(true)
    expect(v.message).toMatch(/draft/i)
  })

  it('allows reviewed spec under H2 advisory', () => {
    const v = discussLockVerdict({
      sddMode: 'advisory',
      harnessLevel: 'H2',
      hasSpecId: true,
      specStatus: 'reviewed',
    })
    expect(v.blocked).toBe(false)
  })
})

describe('context-pressure (GSD utilization guard proxy)', () => {
  it('is ok at low turns', () => {
    const v = contextPressureVerdict(
      { maxTurnsPerCycle: 25 } as never,
      { turnCount: 3, description: 'x' } as never
    )
    expect(v.level).toBe('ok')
    expect(v.cue).toBeNull()
  })

  it('warns near 60% of turn budget', () => {
    const v = contextPressureVerdict(
      { maxTurnsPerCycle: 10 } as never,
      { turnCount: 6, description: 'x' } as never
    )
    expect(v.level).toBe('warn')
    expect(v.cue).toMatch(/context pressure/i)
  })

  it('critical near 70%', () => {
    const v = contextPressureVerdict(
      { maxTurnsPerCycle: 10 } as never,
      { turnCount: 8, description: 'x' } as never
    )
    expect(v.level).toBe('critical')
    expect(v.cue).toMatch(/LAND|prime|critical/i)
  })
})

describe('nyquist-lite (verifiable ACs)', () => {
  it('accepts test-named criteria', () => {
    expect(isVerifiableAcceptance('bun test core/foo.test.ts passes')).toBe(true)
    expect(isVerifiableAcceptance('curl returns 200 on /health')).toBe(true)
  })

  it('rejects vague prose', () => {
    expect(isVerifiableAcceptance('auth feels solid')).toBe(false)
  })

  it('reports vague list', () => {
    const r = assessAcceptanceCriteria(['user can log in', 'bun test core/auth.test.ts is green'])
    expect(r.ok).toBe(false)
    expect(r.vague.length).toBe(1)
    expect(r.verifiable).toBe(1)
  })
})
