import { describe, it, expect } from 'vitest'

describe('Vitest Setup', () => {
  it('should run tests', () => {
    expect(true).toBe(true)
  })

  it('should support basic assertions', () => {
    const value = 'test'
    expect(value).toBe('test')
    expect(value).toHaveLength(4)
  })

  it('should support async tests', async () => {
    const promise = Promise.resolve('async value')
    await expect(promise).resolves.toBe('async value')
  })
})
