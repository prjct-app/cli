/**
 * content-fingerprint — the normalization contract shared by the dedup net
 * (projectMemory.remember) and the heal migration (memory-dedup-content-hash).
 * If these two ever disagree, historical dups stop being recognized, so the
 * normalization rules are pinned here.
 */

import { describe, expect, it } from 'bun:test'
import { memoryFingerprint } from '../../memory/content-fingerprint'

describe('memoryFingerprint', () => {
  it('is stable for identical content', () => {
    expect(memoryFingerprint('use bun runtime')).toBe(memoryFingerprint('use bun runtime'))
  })

  it('ignores case', () => {
    expect(memoryFingerprint('Use Bun Runtime')).toBe(memoryFingerprint('use bun runtime'))
  })

  it('collapses internal whitespace runs and trims edges', () => {
    expect(memoryFingerprint('  use   bun\n\truntime  ')).toBe(memoryFingerprint('use bun runtime'))
  })

  it('distinguishes genuinely different content', () => {
    expect(memoryFingerprint('use bun')).not.toBe(memoryFingerprint('use node'))
  })

  it('returns a 64-char hex sha256', () => {
    expect(memoryFingerprint('anything')).toMatch(/^[a-f0-9]{64}$/)
  })
})
