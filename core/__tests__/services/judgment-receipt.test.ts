import { describe, expect, test } from 'bun:test'
import { buildJudgmentReceipt, summarizeJudgmentReceipt } from '../../services/judgment-receipt'

describe('buildJudgmentReceipt', () => {
  test('returns null when no durable signal', () => {
    expect(buildJudgmentReceipt({})).toBeNull()
    expect(buildJudgmentReceipt({ trapsSurfaced: [], journal: [] })).toBeNull()
  })

  test('full fixture includes non-empty sections only', () => {
    const out = buildJudgmentReceipt({
      cycleDescription: 'implement closed-loop judgment',
      journal: ['wired pre-edit', 'added receipt builder'],
      trapsSurfaced: [{ id: 'mem_1', type: 'gotcha', title: 'stale daemon caches hook code' }],
      decisions: [
        {
          id: 'mem_2',
          type: 'decision',
          title: 'not AI memory product',
          status: 'honored',
        },
      ],
      openRisksNext: ['Finish work cycle before context dies'],
      tokensIn: 100,
      tokensOut: 50,
      model: 'test-model',
    })
    expect(out).not.toBeNull()
    expect(out!).toContain('# Judgment Receipt')
    expect(out!).toContain('## Applied judgment')
    expect(out!).toContain('## Traps re-surfaced')
    expect(out!).toContain('mem_1')
    expect(out!).toContain('## Decisions contested or honored')
    expect(out!).toContain('honored')
    expect(out!).toContain('## Open risks / next')
    expect(out!).toContain('## Session economics')
    expect(out!).toContain('total=150')
    expect(out!).toContain('continuity')
    // no empty unknown spam
    expect(out!).not.toContain('unknown')
  })

  test('sparse fixture omits empty sections', () => {
    const out = buildJudgmentReceipt({
      trapsSurfaced: [{ id: 'mem_9', type: 'gotcha', title: 'only traps' }],
    })
    expect(out).not.toBeNull()
    expect(out!).toContain('## Traps re-surfaced')
    expect(out!).not.toContain('## Session economics')
    expect(out!).not.toContain('## Decisions contested or honored')
  })

  test('summarizeJudgmentReceipt counts traps', () => {
    const content = buildJudgmentReceipt({
      trapsSurfaced: [
        { id: 'mem_1', type: 'gotcha', title: 'a' },
        { id: 'mem_2', type: 'gotcha', title: 'b' },
      ],
    })
    const summary = summarizeJudgmentReceipt(content)
    expect(summary).toContain('2 trap')
  })
})
