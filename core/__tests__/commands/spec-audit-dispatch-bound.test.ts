/**
 * renderAuditDispatch — the spec lives in prjct, never in the prompt.
 *
 * MUST: no plan/memory/task is duplicated outside prjct's SQLite + vault.
 * The audit-spec dispatch POINTS each reviewer at `prjct spec show <id>
 * --md` instead of pasting the spec body — that also keeps the 3×
 * reviewer fan-out payload tiny.
 */

import { describe, expect, it } from 'bun:test'
import { renderAuditDispatch } from '../../commands/spec'
import { emptySpecContent } from '../../types/spec'

describe('renderAuditDispatch — points reviewers at prjct, never embeds the spec', () => {
  it('does NOT embed the spec body, even pathological free text', () => {
    const c = emptySpecContent('Add rate limiting to the auth endpoint')
    const canary = 'CANARY_SECRET_PLAN_TEXT_should_never_appear_in_prompt'
    c.notes = canary
    c.eli10 = `${canary}_eli10`
    const out = renderAuditDispatch('spec-abc123', 'Rate limiting', c)
    expect(out).not.toContain(canary)
    expect(out).not.toContain('```json')
  })

  it('instructs every reviewer to read the spec from prjct by id', () => {
    const out = renderAuditDispatch('spec-abc123', 'Rate limiting', emptySpecContent('g'))
    // One per reviewer (A/B/C) + the "where it lives" block.
    const occurrences = out.split('prjct spec show spec-abc123 --md').length - 1
    expect(occurrences).toBeGreaterThanOrEqual(3)
    expect(out).toContain('it is NOT in this prompt')
  })

  it('still hands reviewers codebase PATHS (pointers, not pasted source)', () => {
    const c = emptySpecContent('g')
    c.scope = ['core/auth/limiter.ts — the limiter']
    const out = renderAuditDispatch('spec-x', 'X', c)
    expect(out).toContain('core/auth/limiter.ts')
    expect(out).toContain('Read tool')
  })

  it('keeps the non-implementer model policy in the dispatch', () => {
    const out = renderAuditDispatch('spec-x', 'X', emptySpecContent('g'))
    expect(out).toContain('model: "sonnet"')
    expect(out).toContain("NOT the parent's max model")
  })
})
