import { describe, expect, it } from 'bun:test'
import { _internal } from '../../hooks/pre-search'

describe('pre-search extractToken', () => {
  it('pulls longest identifier from grep pattern', () => {
    expect(_internal.extractToken({ tool_input: { pattern: 'validateUser' } })).toBe('validateUser')
    expect(_internal.extractToken({ tool_input: { pattern: 'function\\s+ProcessOrder\\(' } })).toBe(
      'ProcessOrder'
    )
  })

  it('returns null for empty / noise-only', () => {
    expect(_internal.extractToken({ tool_input: { pattern: '.*' } })).toBeNull()
    expect(_internal.extractToken({ tool_input: {} })).toBeNull()
  })
})
