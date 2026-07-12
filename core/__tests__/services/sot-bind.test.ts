/**
 * SoT hard-bind (Dynasty D3) — pure verdict matrix.
 */

import { describe, expect, it } from 'bun:test'
import { candidatesFromPreventive } from '../../services/decision-conflict'
import { filterSotCandidates, isSotBindType, sotBindVerdict } from '../../services/sot-bind'

describe('sot-bind', () => {
  const highDecision = candidatesFromPreventive([
    {
      id: 'mem_sot1',
      type: 'decision',
      content: 'Never shell-spawn git without execFileAsync sandbox',
    },
  ])
  const patternOnly = candidatesFromPreventive([
    {
      id: 'mem_pat',
      type: 'pattern',
      content: 'Prefer progressive disclosure for skill bodies always',
    },
  ])

  it('classifies SoT types', () => {
    expect(isSotBindType('decision')).toBe(true)
    expect(isSotBindType('gotcha')).toBe(true)
    expect(isSotBindType('fact')).toBe(true)
    expect(isSotBindType('pattern')).toBe(false)
    expect(isSotBindType('learning')).toBe(false)
  })

  it('filters SUGGEST out of SoT candidates', () => {
    expect(filterSotCandidates([...highDecision, ...patternOnly]).map((c) => c.id)).toEqual([
      'mem_sot1',
    ])
  })

  it('H2/H3 hard-denies high-confidence SoT', () => {
    for (const level of ['H2', 'H3'] as const) {
      const v = sotBindVerdict({
        harnessLevel: level,
        candidates: highDecision,
        fileLabel: 'shipping.ts',
      })
      expect(v.action).toBe('deny')
      expect(v.reason).toBe('h2-sot-deny')
      expect(v.message).toMatch(/SoT bind|hard-bind/i)
      expect(v.message).toContain('mem_sot1')
      expect(v.message).toMatch(/supersede|override/i)
    }
  })

  it('H1 warns only', () => {
    const v = sotBindVerdict({ harnessLevel: 'H1', candidates: highDecision })
    expect(v.action).toBe('warn')
    expect(v.reason).toBe('h1-sot-warn')
    expect(v.message).toContain('soft-bind')
  })

  it('H0 and null never deny', () => {
    expect(sotBindVerdict({ harnessLevel: 'H0', candidates: highDecision }).action).toBe('none')
    expect(sotBindVerdict({ harnessLevel: null, candidates: highDecision }).action).toBe('none')
  })

  it('override lifts deny', () => {
    const v = sotBindVerdict({
      harnessLevel: 'H2',
      candidates: highDecision,
      overriddenIds: ['mem_sot1'],
    })
    expect(v.action).toBe('none')
    expect(v.reason).toBe('no-sot')
  })

  it('pattern-only never SoT-denies on H2', () => {
    const v = sotBindVerdict({ harnessLevel: 'H2', candidates: patternOnly })
    expect(v.action).toBe('none')
  })
})
