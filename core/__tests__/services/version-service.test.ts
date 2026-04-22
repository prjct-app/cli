import { describe, expect, it } from 'bun:test'
import { bumpPatch } from '../../services/version-service'

describe('bumpPatch', () => {
  it('bumps stable patch', () => {
    expect(bumpPatch('1.2.3')).toBe('1.2.4')
    expect(bumpPatch('0.0.0')).toBe('0.0.1')
    expect(bumpPatch('10.20.30')).toBe('10.20.31')
  })

  it('increments trailing numeric identifier in prerelease', () => {
    expect(bumpPatch('2.0.0-alpha.12')).toBe('2.0.0-alpha.13')
    expect(bumpPatch('1.0.0-rc.0')).toBe('1.0.0-rc.1')
    expect(bumpPatch('3.1.4-beta.99')).toBe('3.1.4-beta.100')
  })

  it('appends .1 to prerelease without numeric tail', () => {
    expect(bumpPatch('0.1.0-beta')).toBe('0.1.0-beta.1')
    expect(bumpPatch('1.0.0-alpha')).toBe('1.0.0-alpha.1')
    expect(bumpPatch('2.0.0-rc')).toBe('2.0.0-rc.1')
  })

  it('handles multi-segment prerelease with numeric tail', () => {
    expect(bumpPatch('1.0.0-alpha.beta.5')).toBe('1.0.0-alpha.beta.6')
  })

  it('appends .1 when multi-segment prerelease ends non-numerically', () => {
    expect(bumpPatch('1.0.0-alpha.beta')).toBe('1.0.0-alpha.beta.1')
  })

  it('drops build metadata on bump', () => {
    expect(bumpPatch('1.2.3+build.42')).toBe('1.2.4')
    expect(bumpPatch('2.0.0-alpha.1+sha.abc')).toBe('2.0.0-alpha.2')
  })

  it('returns unchanged when input is not a valid semver', () => {
    expect(bumpPatch('not-a-version')).toBe('not-a-version')
    expect(bumpPatch('1.2')).toBe('1.2')
    expect(bumpPatch('')).toBe('')
    expect(bumpPatch('v1.2.3')).toBe('v1.2.3')
  })

  it('does NOT regress prerelease to stable (P0 guard)', () => {
    expect(bumpPatch('2.0.0-alpha.12')).not.toBe('2.0.1')
    expect(bumpPatch('1.0.0-rc.1')).not.toBe('1.0.1')
  })
})
