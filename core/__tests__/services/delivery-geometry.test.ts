import { describe, expect, it } from 'bun:test'
import {
  geometryBlockMessage,
  geometryOf,
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
})
