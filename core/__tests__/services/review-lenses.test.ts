/**
 * Shared review-lens roster (harness pillar 3): the specialists the multi-agent
 * review composes from — used by BOTH spec-audit and the crew, so "the
 * specialists you need" is one catalog, not a fixed trio.
 */

import { describe, expect, it } from 'bun:test'
import { FLOOR_LENS, LENS_CATALOG, reviewLensMenu } from '../../services/review-lenses'

describe('review lenses', () => {
  it('keeps architecture as the floor lens, present in the catalog', () => {
    expect(FLOOR_LENS).toBe('architecture')
    expect(LENS_CATALOG[FLOOR_LENS]).toBeDefined()
  })

  it('offers a composable specialist menu (not a fixed trio)', () => {
    for (const lens of ['security', 'data', 'performance', 'design', 'strategic']) {
      expect(LENS_CATALOG[lens]).toBeDefined()
    }
    const menu = reviewLensMenu()
    expect(menu).toContain('`architecture`')
    expect(menu).toContain('`security`')
    expect(menu).toContain('(threat surface)')
  })
})
