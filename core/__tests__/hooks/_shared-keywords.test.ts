/**
 * extractKeywords contract — the tokenizer that feeds the UserPromptSubmit
 * hook's recall + FTS5 MATCH. A regression here changes what memory the
 * model sees on every prompt, so lock down the load-bearing properties.
 */

import { describe, expect, it } from 'bun:test'
import { extractKeywords } from '../../hooks/_shared'

describe('extractKeywords — camelCase awareness', () => {
  it('splits camelCase identifiers into atomic tokens', () => {
    const kw = extractKeywords('how is setupAuthCallback wired?')
    expect(kw).toContain('setup')
    expect(kw).toContain('auth')
    expect(kw).toContain('callback')
  })

  it('splits PascalCase too', () => {
    const kw = extractKeywords('AuthService is calling RefreshTokenStore directly')
    expect(kw).toContain('auth')
    expect(kw).toContain('service')
    expect(kw).toContain('refresh')
    expect(kw).toContain('token')
    expect(kw).toContain('store')
  })

  it('handles ALLCAPS gracefully (HTTP, API)', () => {
    const kw = extractKeywords('HTTPRequest is wrapped by ApiClient')
    expect(kw).toContain('http')
    expect(kw).toContain('request')
    expect(kw).toContain('api')
    expect(kw).toContain('client')
  })
})

describe('extractKeywords — stoplist tuning', () => {
  it('keeps intent-bearing verbs like need / want / should / could', () => {
    const kw = extractKeywords('we need stripe; should we cache responses?')
    expect(kw).toContain('need')
    expect(kw).toContain('should')
    expect(kw).toContain('stripe')
    expect(kw).toContain('cache')
  })

  it('still drops true noise words', () => {
    const kw = extractKeywords('this is what they were doing about that')
    expect(kw).not.toContain('this')
    expect(kw).not.toContain('what')
    expect(kw).not.toContain('they')
    expect(kw).not.toContain('were')
    expect(kw).not.toContain('about')
    expect(kw).not.toContain('that')
  })
})

describe('extractKeywords — dedupe + cap', () => {
  it('returns unique tokens only', () => {
    const kw = extractKeywords('auth auth auth oauth')
    expect(kw.filter((k) => k === 'auth').length).toBe(1)
  })

  it('caps at maxCount', () => {
    const kw = extractKeywords(
      'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo',
      5
    )
    expect(kw.length).toBeLessThanOrEqual(5)
  })

  it('returns empty for empty input', () => {
    expect(extractKeywords('')).toEqual([])
    expect(extractKeywords('   ')).toEqual([])
  })
})

describe('extractKeywords — minimum length', () => {
  it('drops tokens under 3 chars', () => {
    const kw = extractKeywords('do we go up or down with auth?')
    expect(kw).not.toContain('do')
    expect(kw).not.toContain('we')
    expect(kw).not.toContain('go')
    expect(kw).not.toContain('up')
    expect(kw).not.toContain('or')
    expect(kw).toContain('auth')
    expect(kw).toContain('down')
  })
})
