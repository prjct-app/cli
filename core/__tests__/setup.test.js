import { describe, it, expect } from 'vitest'

describe('Vitest Setup', () => {
  it('should pass basic assertion', () => {
    expect(true).toBe(true)
  })

  it('should handle numbers', () => {
    expect(2 + 2).toBe(4)
  })

  it('should handle strings', () => {
    expect('prjct-cli').toContain('prjct')
  })
})
