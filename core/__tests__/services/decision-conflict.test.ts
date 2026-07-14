import { describe, expect, test } from 'bun:test'
import {
  budgetExceeded,
  CONFLICT_HARD_CAP_MS,
  candidatesFromPreventive,
  decisionConflictVerdict,
  effectiveConflictMode,
} from '../../services/decision-conflict'
import type { LocalConfig } from '../../types/config'

const highGotcha = {
  id: 'mem_100',
  type: 'gotcha',
  content: 'Never force-push main after ship — rewrite breaks stack PRs',
  confidence: 'high' as const,
}
const lowWeak = {
  id: 'mem_101',
  type: 'fact',
  content: 'short',
  confidence: 'low' as const,
}

describe('effectiveConflictMode', () => {
  test('explicit config wins over packs', () => {
    const cfg = {
      projectId: 'p',
      dataPath: 'x',
      judgment: { conflictMode: 'off' as const },
      persona: { role: 'DEV', packs: ['code-strict'] },
    } satisfies LocalConfig
    expect(effectiveConflictMode(cfg)).toBe('off')
  })

  test('does not read land.mode or sdd.mode — quiet off default', () => {
    const cfg = {
      projectId: 'p',
      dataPath: 'x',
      land: { mode: 'strict' as const },
      sdd: { mode: 'strict' as const },
    } satisfies LocalConfig
    // unset judgment → off (not strict/advisory from land/sdd)
    expect(effectiveConflictMode(cfg)).toBe('off')
  })

  test('code pack → advisory; code-strict → strict when judgment unset', () => {
    expect(
      effectiveConflictMode({
        projectId: 'p',
        dataPath: 'x',
        persona: { role: 'DEV', packs: ['code'] },
      })
    ).toBe('advisory')
    expect(
      effectiveConflictMode({
        projectId: 'p',
        dataPath: 'x',
        persona: { role: 'DEV', packs: ['code-strict'] },
      })
    ).toBe('strict')
  })
})

describe('decisionConflictVerdict', () => {
  test('mode off → none', () => {
    const v = decisionConflictVerdict({ mode: 'off', candidates: [highGotcha] })
    expect(v.action).toBe('none')
  })

  test('empty candidates → none', () => {
    expect(decisionConflictVerdict({ mode: 'strict', candidates: [] }).action).toBe('none')
  })

  test('advisory + high → warn never deny', () => {
    const v = decisionConflictVerdict({ mode: 'advisory', candidates: [highGotcha] })
    expect(v.action).toBe('warn')
    expect(v.memoryIds).toContain('mem_100')
    expect(v.message).toContain('CONFLICT')
    expect(v.recovery).toContain('conflict:override')
  })

  test('strict + high → deny with recovery', () => {
    const v = decisionConflictVerdict({
      mode: 'strict',
      candidates: [highGotcha],
      fileLabel: 'ship.ts',
    })
    expect(v.action).toBe('deny')
    expect(v.message).toContain('conflict deny')
    expect(v.message).toContain('mem_100')
    expect(v.recovery).toContain('remember feedback')
  })

  test('strict + low only → warn never deny', () => {
    const v = decisionConflictVerdict({ mode: 'strict', candidates: [lowWeak] })
    expect(v.action).toBe('warn')
  })

  test('override lifts high deny → none', () => {
    const v = decisionConflictVerdict({
      mode: 'strict',
      candidates: [highGotcha],
      overriddenIds: ['mem_100'],
    })
    expect(v.action).toBe('none')
  })

  test('override then subsequent edit allowed (matrix)', () => {
    const denied = decisionConflictVerdict({
      mode: 'strict',
      candidates: [highGotcha],
    })
    expect(denied.action).toBe('deny')
    const after = decisionConflictVerdict({
      mode: 'strict',
      candidates: [highGotcha],
      overriddenIds: new Set(denied.memoryIds),
    })
    expect(after.action).toBe('none')
  })
})

describe('candidatesFromPreventive + budget', () => {
  test('maps long gotcha to high confidence', () => {
    const c = candidatesFromPreventive([
      {
        id: 'mem_1',
        type: 'gotcha',
        content: 'A sufficiently long preventive gotcha about the file path',
      },
    ])
    expect(c[0].confidence).toBe('high')
  })

  test('budgetExceeded after hard cap', () => {
    expect(budgetExceeded(Date.now() - (CONFLICT_HARD_CAP_MS + 50))).toBe(true)
    expect(budgetExceeded(Date.now())).toBe(false)
  })
})
