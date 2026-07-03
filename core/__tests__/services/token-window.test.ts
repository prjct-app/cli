import { describe, expect, it } from 'bun:test'
import { sumTranscriptUsage, sumTranscriptUsageByModel } from '../../services/transcript-jsonl'

const line = (ts: string, model: string, inTok: number, outTok: number) => ({
  timestamp: ts,
  message: { model, usage: { input_tokens: inTok, output_tokens: outTok } },
})

describe('usage window attribution', () => {
  const lines = [
    line('2026-07-01T10:00:00Z', 'claude-opus-4-8', 100, 10),
    line('2026-07-01T11:00:00Z', 'claude-opus-4-8', 200, 20),
    line('2026-07-01T12:00:00Z', 'claude-haiku-4-5', 50, 5),
  ]

  it('windows by [since, until) so a task is billed only its own turns', () => {
    const u = sumTranscriptUsage(lines, {
      sinceIso: '2026-07-01T10:30:00Z',
      untilIso: '2026-07-01T12:00:00Z',
    })
    expect(u.tokensIn).toBe(200) // only the 11:00 line
    expect(u.tokensOut).toBe(20)
  })

  it('no window = everything (live cumulative path unchanged)', () => {
    const u = sumTranscriptUsage(lines)
    expect(u.tokensIn).toBe(350)
  })

  it('per-model split respects the window', () => {
    const byModel = sumTranscriptUsageByModel(lines, { sinceIso: '2026-07-01T11:30:00Z' })
    expect(byModel.get('claude-haiku-4-5')?.tokensIn).toBe(50)
    expect(byModel.has('claude-opus-4-8')).toBe(false)
  })

  it('with a window, timestamp-less lines are excluded (no unattributable leakage)', () => {
    const noTs = [{ message: { model: 'm', usage: { input_tokens: 999, output_tokens: 9 } } }]
    expect(sumTranscriptUsage(noTs, { sinceIso: '2026-07-01T00:00:00Z' }).tokensIn).toBe(0)
    expect(sumTranscriptUsage(noTs).tokensIn).toBe(999) // unwindowed keeps them
  })
})
