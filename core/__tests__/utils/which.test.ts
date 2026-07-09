/**
 * Cross-platform which/where helpers — pin that detection never throws
 * and resolves something for the current process runner when possible.
 */

import { describe, expect, it } from 'bun:test'
import { commandOnPath, whichAsync, whichSync } from '../../utils/which'

describe('which (cross-platform PATH resolve)', () => {
  it('whichSync never throws on missing commands', () => {
    expect(whichSync('prjct-definitely-not-installed-xyz-9f3a')).toBeNull()
  })

  it('whichAsync never throws on missing commands', async () => {
    expect(await whichAsync('prjct-definitely-not-installed-xyz-9f3a')).toBeNull()
  })

  it('resolves a known OS binary when present', () => {
    // node or bun should exist in this test environment.
    const node = whichSync('node')
    const bun = whichSync('bun')
    expect(node !== null || bun !== null).toBe(true)
    if (node) expect(node.length).toBeGreaterThan(0)
    if (bun) expect(bun.length).toBeGreaterThan(0)
  })

  it('commandOnPath mirrors whichSync', () => {
    expect(commandOnPath('prjct-definitely-not-installed-xyz-9f3a')).toBe(false)
    const hasNode = whichSync('node') !== null
    expect(commandOnPath('node')).toBe(hasNode)
  })
})
