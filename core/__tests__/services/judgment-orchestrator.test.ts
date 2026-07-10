/**
 * Quality orchestrator P0 — auto ledger, inject, never auto-ship.
 */

import { describe, expect, it } from 'bun:test'
import {
  formatQualityInject,
  intensityFromQuality,
  qualityFromIntensity,
  SHIP_USER_ONLY,
  shipRequiresQuality,
} from '../../services/judgment-orchestrator'
import {
  buildNextAction,
  createLedger,
  judgmentShipVerdict,
} from '../../services/precision-judgment'
import { orchestrationFor } from '../../services/task-orchestration'

describe('quality ceremony mapping', () => {
  it('maps intensity ↔ quality', () => {
    expect(qualityFromIntensity('skip')).toBe('none')
    expect(qualityFromIntensity('standard')).toBe('standard')
    expect(qualityFromIntensity('full')).toBe('full')
    expect(intensityFromQuality('none')).toBe('skip')
    expect(intensityFromQuality('full')).toBe('full')
  })

  it('shipRequiresQuality is true only when intensity is not skip', () => {
    expect(shipRequiresQuality('skip')).toBe(false)
    expect(shipRequiresQuality('standard')).toBe(true)
    expect(shipRequiresQuality('full')).toBe(true)
  })
})

describe('orchestration includes quality + anti-auto-ship', () => {
  it('H0 has quality none and never-auto-ship line', () => {
    const p = orchestrationFor({ level: 'H0', kind: 'docs', risk: 'low' })
    expect(p.quality).toBe('none')
    expect(p.directive).toContain(SHIP_USER_ONLY)
  })

  it('H1 code gets standard quality', () => {
    const p = orchestrationFor({ level: 'H1', kind: 'feature', risk: 'low' })
    expect(p.quality).toBe('standard')
    expect(p.directive).toMatch(/quality auto/i)
    expect(p.directive).toContain(SHIP_USER_ONLY)
  })

  it('H3 security gets full quality', () => {
    const p = orchestrationFor({ level: 'H3', kind: 'security', risk: 'high' })
    expect(p.quality).toBe('full')
    expect(p.directive).toContain(SHIP_USER_ONLY)
  })
})

describe('formatQualityInject', () => {
  it('returns null for skip intensity', () => {
    const card = buildNextAction(null, 'skip')
    expect(formatQualityInject(card, null)).toBeNull()
  })

  it('never suggests prjct ship as a step', () => {
    const ledger = createLedger({ target: 't', intensity: 'full', now: 't0' })
    const card = buildNextAction(ledger, 'full')
    const md = formatQualityInject(card, ledger)
    expect(md).toBeTruthy()
    expect(md!).toContain(SHIP_USER_ONLY)
    // May list "prjct ship" only in the forbidden sense for approved path;
    // incomplete ledger must not instruct the agent to ship unsolicited.
    if (card.kind !== 'approve' && card.kind !== 'skip_ship') {
      const stepsOnly = card.steps.join('\n')
      // open_ledger / dispatch steps should not be "prjct ship" alone as primary action
      expect(stepsOnly === 'prjct ship').toBe(false)
    }
  })

  it('approved ledger reminds human-only ship', () => {
    const ledger = createLedger({ target: 't', intensity: 'standard', now: 't0' })
    ledger.verdict = 'approved'
    const card = buildNextAction(ledger, 'standard')
    const md = formatQualityInject(card, ledger)
    expect(md).toMatch(/APPROVED/i)
    expect(md).toContain(SHIP_USER_ONLY)
    expect(md).toMatch(/wait for the user/i)
  })
})

describe('ship gate by intensity (human-invoked ship only)', () => {
  it('hard-blocks standard intensity without ledger', () => {
    const v = judgmentShipVerdict({
      codeStrict: true, // orchestrator sets this via shipRequiresQuality
      intensity: 'standard',
      ledger: null,
      override: false,
    })
    expect(v.blocked).toBe(true)
    expect(v.mode).toBe('hard')
  })

  it('skip intensity never blocks', () => {
    const v = judgmentShipVerdict({
      codeStrict: true,
      intensity: 'skip',
      ledger: null,
      override: false,
    })
    expect(v.blocked).toBe(false)
  })
})

describe('no auto-ship path in orchestrator module', () => {
  it('SHIP_USER_ONLY forbids unsolicited ship', () => {
    expect(SHIP_USER_ONLY).toMatch(/user-only/i)
    expect(SHIP_USER_ONLY).toMatch(/explicitly asked/i)
  })
})
