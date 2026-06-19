/**
 * Dynamic audit-spec lenses.
 *
 * `selectReviewers` is the deterministic baseline (no LLM): `architecture`
 * is the floor; lenses are added when the spec text signals their concern.
 * `reviewsGatePassed` is the auto-promote gate over the SELECTED set, with a
 * legacy fallback to the three baseline lenses when no set was recorded.
 */

import { describe, expect, it } from 'bun:test'
import { reviewsGatePassed, selectReviewers } from '../../services/spec-audit-dispatch'
import { emptySpecContent, type SpecContent, type SpecReview } from '../../types/spec'

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
