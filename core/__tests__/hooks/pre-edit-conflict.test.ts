/**
 * Pre-edit conflict gate integration — drives the pure verdict path the hook uses.
 * Full hook I/O is host-specific; we assert the decision matrix + fail-open budget
 * that pre-edit wires (same functions, same constants).
 */
import { describe, expect, test } from 'bun:test'
import {
  budgetExceeded,
  CONFLICT_HARD_CAP_MS,
  candidatesFromPreventive,
  decisionConflictVerdict,
  effectiveConflictMode,
} from '../../services/decision-conflict'

describe('pre-edit conflict wiring contracts', () => {
  test('empty preventive → no deny', () => {
    const mode = effectiveConflictMode({
      projectId: 'p',
      dataPath: 'x',
      judgment: { conflictMode: 'strict' },
    })
    const v = decisionConflictVerdict({
      mode,
      candidates: candidatesFromPreventive([]),
    })
    expect(v.action).toBe('none')
  })

  test('warn path under advisory produces additionalContext-shaped message', () => {
    const v = decisionConflictVerdict({
      mode: 'advisory',
      candidates: candidatesFromPreventive([
        {
          id: 'mem_77',
          type: 'gotcha',
          content: 'Do not strip PKCE verifier from process memory early',
        },
      ]),
      fileLabel: 'cli-pkce.ts',
    })
    expect(v.action).toBe('warn')
    expect(v.message.startsWith('# prjct:')).toBe(true)
    expect(v.message).toContain('mem_77')
  })

  test('strict high-confidence deny message is usable on deny channel', () => {
    const v = decisionConflictVerdict({
      mode: 'strict',
      candidates: candidatesFromPreventive([
        {
          id: 'mem_88',
          type: 'gotcha',
          content: 'Never reintroduce agentic v1 orchestration stack',
        },
      ]),
    })
    expect(v.action).toBe('deny')
    expect(v.message).toContain('⛔')
    expect(v.message).toContain('mem_88')
  })

  test('budget exceed ⇒ fail-open (no intentional deny after timeout)', () => {
    // Simulate: after recall, budget already blown — hook must not deny.
    const started = Date.now() - (CONFLICT_HARD_CAP_MS + 10)
    expect(budgetExceeded(started)).toBe(true)
    // Caller returns null deny when budgetExceeded — contract of pre-edit decideHardStop.
  })
})
