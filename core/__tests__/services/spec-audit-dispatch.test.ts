/**
 * Dynamic audit-spec lenses.
 *
 * `selectReviewers` is the deterministic baseline (no LLM): `architecture`
 * is the floor; lenses are added when the spec text signals their concern.
 * `reviewsGatePassed` is the auto-promote gate over the SELECTED set, with a
 * legacy fallback to the three baseline lenses when no set was recorded.
 */

import { describe, expect, it } from 'bun:test'
import { LENS_CATALOG } from '../../services/review-lenses'
import {
  renderAuditDispatch,
  reviewsGatePassed,
  selectReviewers,
} from '../../services/spec-audit-dispatch'
import { emptySpecContent, type SpecContent, type SpecReview } from '../../types/spec'
import type { DomainDefinition } from '../../types/storage/extended'

const pass: SpecReview = { verdict: 'pass', notes: 'ok', ts: '2026-06-19T00:00:00.000Z' }
const fail: SpecReview = { verdict: 'fail', notes: 'no', ts: '2026-06-19T00:00:00.000Z' }

describe('selectReviewers — dynamic baseline', () => {
  it('picks ONLY architecture for a trivial spec', () => {
    expect(selectReviewers(emptySpecContent('Fix a typo in the README'))).toEqual(['architecture'])
  })

  it('adds security + data for an auth + migration spec', () => {
    const lenses = selectReviewers(emptySpecContent('Add token auth and a DB schema migration'))
    expect(lenses).toContain('architecture')
    expect(lenses).toContain('security')
    expect(lenses).toContain('data')
    expect(lenses.length).toBeGreaterThanOrEqual(3)
  })

  it('adds design for a CLI/UI surface spec', () => {
    expect(selectReviewers(emptySpecContent('New CLI command with --flag output'))).toContain(
      'design'
    )
  })

  it('adds strategic when scope is large', () => {
    const c = emptySpecContent('Big refactor')
    c.scope = ['a', 'b', 'c', 'd', 'e']
    expect(selectReviewers(c)).toContain('strategic')
  })

  it('adds strategic when stakes are set', () => {
    const c = emptySpecContent('Risky change')
    c.stakes = 'breaks billing if wrong'
    expect(selectReviewers(c)).toContain('strategic')
  })
})

describe('reviewsGatePassed — gate over the selected set', () => {
  const withReviews = (selected: string[], reviews: Record<string, SpecReview>): SpecContent => ({
    ...emptySpecContent('g'),
    selected_reviewers: selected,
    reviews,
  })

  it('passes when every selected lens passed', () => {
    expect(
      reviewsGatePassed(
        withReviews(['architecture', 'security'], { architecture: pass, security: pass })
      )
    ).toBe(true)
  })

  it('fails when a selected lens failed', () => {
    expect(
      reviewsGatePassed(
        withReviews(['architecture', 'security'], { architecture: pass, security: fail })
      )
    ).toBe(false)
  })

  it('fails when a selected lens is missing', () => {
    expect(
      reviewsGatePassed(withReviews(['architecture', 'security'], { architecture: pass }))
    ).toBe(false)
  })

  it('does NOT require unselected lenses (a 1-lens spec promotes on 1 pass)', () => {
    expect(reviewsGatePassed(withReviews(['architecture'], { architecture: pass }))).toBe(true)
  })

  it('legacy fallback: empty selected_reviewers ⇒ the three baseline lenses', () => {
    expect(
      reviewsGatePassed(withReviews([], { strategic: pass, architecture: pass, design: pass }))
    ).toBe(true)
    // Legacy partial (only 2 of 3 baseline) does not promote.
    expect(reviewsGatePassed(withReviews([], { strategic: pass, architecture: pass }))).toBe(false)
  })

  it('no reviews at all ⇒ false', () => {
    expect(reviewsGatePassed(emptySpecContent('g'))).toBe(false)
  })
})

describe('renderAuditDispatch — per-lens model routing (GAP 2)', () => {
  it('runs a capabilityClass:fast lens on the cheap model; the rest stay review-tier', async () => {
    // Inject a narrow opt-in lens; clean up after so the catalog is unchanged.
    LENS_CATALOG['narrow-lint'] = {
      label: 'cheap lint',
      rubric: 'Lint the spec for trivial issues.',
      capabilityClass: 'fast',
    }
    try {
      const out = await renderAuditDispatch(
        'spec_1',
        'T',
        emptySpecContent('x'),
        ['architecture', 'narrow-lint'],
        'claude'
      )
      // The narrow lens names the fast model inline...
      expect(out).toContain('model: "haiku"')
      // ...while the global review-tier directive stays on the balanced model.
      expect(out).toContain('model: "sonnet"')
    } finally {
      delete LENS_CATALOG['narrow-lint']
    }
  })

  it('with no opt-in lens, every reviewer stays on the review tier (behavior-preserving)', async () => {
    const out = await renderAuditDispatch(
      'spec_2',
      'T',
      emptySpecContent('x'),
      ['architecture', 'security'],
      'claude'
    )
    expect(out).not.toContain('model: "haiku"')
  })
})

describe('selectReviewers — DOMAIN experts (GAP 1)', () => {
  const authDomain: DomainDefinition = {
    name: 'auth',
    description: 'Authentication + sessions',
    keywords: ['login', 'session'],
    filePatterns: ['**/auth/**'],
    fileCount: 5,
  }

  it('adds the domain expert when a scope path matches its filePatterns', () => {
    const c = emptySpecContent('Add a thing')
    c.scope = ['core/auth/login.ts']
    const lenses = selectReviewers(c, [authDomain])
    expect(lenses).toContain('auth')
    expect(lenses).toContain('architecture')
  })

  it('adds the domain expert when its keywords hit the spec text', () => {
    expect(selectReviewers(emptySpecContent('Refactor the login flow'), [authDomain])).toContain(
      'auth'
    )
  })

  it('does NOT shadow a function lens with a same-named domain', () => {
    const dataDomain: DomainDefinition = {
      name: 'data',
      description: 'x',
      keywords: ['table'],
      filePatterns: [],
      fileCount: 1,
    }
    // 'table' triggers the built-in `data` function lens; the domain must not duplicate it.
    const lenses = selectReviewers(emptySpecContent('add a table migration'), [dataDomain])
    expect(lenses.filter((l) => l === 'data').length).toBe(1)
  })

  it('no domains ⇒ byte-identical to the function-only baseline', () => {
    const c = emptySpecContent('Add token auth and a DB schema migration')
    expect(selectReviewers(c, [])).toEqual(selectReviewers(c))
  })
})

describe('renderAuditDispatch — domain reviewer section (GAP 1)', () => {
  it('emits the domain-expert rubric for a matched domain', async () => {
    const authDomain: DomainDefinition = {
      name: 'auth',
      description: 'Authentication + sessions',
      keywords: ['login'],
      filePatterns: ['**/auth/**'],
      fileCount: 5,
    }
    const c = emptySpecContent('Refactor the login flow')
    c.scope = ['core/auth/login.ts']
    const out = await renderAuditDispatch('spec_d', 'T', c, undefined, 'claude', [authDomain])
    expect(out).toContain('auth (domain expert)')
    expect(out).toContain('domain specialist')
    expect(out).toContain('prjct context memory auth')
  })
})
