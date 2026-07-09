import { describe, expect, test } from 'bun:test'
import {
  formatEfficiencyMarkdown,
  runEfficiencyBench,
  TASK_SUITE,
} from '../../services/weak-efficiency-bench'

describe('weak-efficiency-bench', () => {
  test('suite has at least 8 realistic tasks', () => {
    expect(TASK_SUITE.length).toBeGreaterThanOrEqual(8)
  })

  test('harness beats bare on completion, intelligence, and tokens', () => {
    const r = runEfficiencyBench()
    expect(r.harness.completionRate).toBeGreaterThan(r.bare.completionRate)
    expect(r.harness.intelligenceScore).toBeGreaterThanOrEqual(r.bare.intelligenceScore + 0.2)
    expect(r.harness.tokens.inputTotal).toBeLessThan(r.bare.tokens.inputTotal)
    expect(r.harness.tokens.wasteTurns).toBeLessThan(r.bare.tokens.wasteTurns)
  })

  test('markdown is a full efficiency report', () => {
    const md = formatEfficiencyMarkdown(runEfficiencyBench())
    expect(md).toContain('Task completion')
    expect(md).toContain('Intelligence')
    expect(md).toContain('Input tokens')
    expect(md).toContain('How prjct helps the weak model')
    expect(md).toContain('haiku')
  })
})
