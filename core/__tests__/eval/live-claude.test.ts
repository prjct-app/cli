import { describe, expect, test } from 'bun:test'
import { extractVerb } from '../../eval/live-claude'

describe('extractVerb', () => {
  test('parses JSON verb field', () => {
    expect(extractVerb('{"verb":"search","reason":"look up memory"}')).toBe('search')
  })

  test('parses bare first token', () => {
    expect(extractVerb('remember\nbecause we should persist')).toBe('remember')
  })

  test('finds non-work verb in prose', () => {
    expect(extractVerb('I would run prjct land to close the session')).toBe('land')
  })

  test('returns null when empty', () => {
    expect(extractVerb('')).toBeNull()
  })
})
