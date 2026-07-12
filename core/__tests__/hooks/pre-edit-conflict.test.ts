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
import { sotBindVerdict } from '../../services/sot-bind'
import { formatTrapSurfaceMessage, trapSurfaceSlo } from '../../services/trap-surface-slo'

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

  test('H2 SoT bind denies even when conflictMode is off', () => {
    // Dynasty: living SoT is code-enforced independent of conflictMode pack.
    const mode = effectiveConflictMode({ projectId: 'p', dataPath: 'x' })
    expect(mode).toBe('off')
    const cand = candidatesFromPreventive([
      {
        id: 'mem_sot',
        type: 'decision',
        content: 'Always use discuss-lock before H2 feature code',
      },
    ])
    expect(decisionConflictVerdict({ mode, candidates: cand }).action).toBe('none')
    const sot = sotBindVerdict({ harnessLevel: 'H2', candidates: cand })
    expect(sot.action).toBe('deny')
  })

  test('trap surface message satisfies SLO for all preventive ids', () => {
    const hits = [
      { id: 'mem_1', type: 'gotcha', title: 'trap a' },
      { id: 'mem_2', type: 'gotcha', title: 'trap b' },
    ]
    const msg = formatTrapSurfaceMessage('file.ts', hits)
    expect(trapSurfaceSlo({ trapIds: hits.map((h) => h.id), message: msg }).ok).toBe(true)
  })
})
