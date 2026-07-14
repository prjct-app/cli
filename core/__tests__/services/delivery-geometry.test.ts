import { describe, expect, it } from 'bun:test'
import {
  geometryBlockMessage,
  geometryOf,
  intentGeometryVerdict,
  NORMAL_MAX_LOC,
  tierOf,
} from '../../services/delivery-geometry'

describe('delivery-geometry', () => {
  it('classifies tiers', () => {
    expect(tierOf({ files: 1, loc: 10 })).toBe('trivial')
    expect(tierOf({ files: 5, loc: 100 })).toBe('normal')
    expect(tierOf({ files: 2, loc: NORMAL_MAX_LOC + 1 })).toBe('large')
  })

  it('maps tiers to geometry', () => {
    expect(geometryOf('trivial')).toBe('direct')
    expect(geometryOf('normal')).toBe('single')
    expect(geometryOf('large')).toBe('split')
  })

  it('block message names the override flag', () => {
    const msg = geometryBlockMessage(
      { base: 'HEAD', files: 20, loc: 900, dirs: ['core', 'docs'], source: 'working-tree' },
      'split'
    )
    expect(msg).toContain('--geometry')
    expect(msg).toContain('900')
  })

  it('intent geometry: H3 without --geometry is advisory (mode off) / strict blocks', () => {
    const soft = intentGeometryVerdict({
      harnessLevel: 'H3',
      harnessRisk: 'high',
      mode: 'off',
      explicitGeometry: null,
    })
    expect(soft.blocked).toBe(false)
    expect(soft.reason).toBe('h2-intent-advisory')
    expect(soft.message).toMatch(/geometry|split|--geometry/i)

    const hard = intentGeometryVerdict({
      harnessLevel: 'H3',
      harnessRisk: 'high',
      mode: 'strict',
      explicitGeometry: null,
    })
    expect(hard.blocked).toBe(true)
    expect(hard.reason).toBe('h2-intent-strict')

    const ok = intentGeometryVerdict({
      harnessLevel: 'H3',
      mode: 'strict',
      explicitGeometry: 'split',
    })
    expect(ok.blocked).toBe(false)
    expect(ok.reason).toBe('has-geometry')
  })

  it('intent geometry: H0 and H2 medium risk skip when tree not large', () => {
    expect(
      intentGeometryVerdict({
        harnessLevel: 'H0',
        mode: 'strict',
        explicitGeometry: null,
      }).reason
    ).toBe('not-large')
    expect(
      intentGeometryVerdict({
        harnessLevel: 'H2',
        harnessRisk: 'medium',
        mode: 'advisory',
        explicitGeometry: null,
        treeLarge: false,
      }).reason
    ).toBe('not-large')
  })
})
