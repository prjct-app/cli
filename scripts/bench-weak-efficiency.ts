#!/usr/bin/env bun
/**
 * Weak-model efficiency + intelligence + token-cost bench.
 *
 * Usage: bun scripts/bench-weak-efficiency.ts
 * Exit 0 when harness completion ≥ bare and intelligence ≥ bare + 20 pts.
 */

import {
  formatEfficiencyMarkdown,
  runEfficiencyBench,
} from '../core/services/weak-efficiency-bench'

const report = runEfficiencyBench()
console.log(formatEfficiencyMarkdown(report))

const okCompletion = report.harness.completionRate >= report.bare.completionRate
const okIntel = report.harness.intelligenceScore >= report.bare.intelligenceScore + 0.2
const okTokens = report.harness.tokens.inputTotal < report.bare.tokens.inputTotal

console.log('')
console.log('## Gates')
console.log(
  `${okCompletion ? '✓' : '✗'} completion: harness ${(report.harness.completionRate * 100).toFixed(0)}% ≥ bare ${(report.bare.completionRate * 100).toFixed(0)}%`
)
console.log(
  `${okIntel ? '✓' : '✗'} intelligence: +${report.deltas.intelligencePts.toFixed(0)} pts (need ≥+20)`
)
console.log(
  `${okTokens ? '✓' : '✗'} tokens: harness ${report.harness.tokens.inputTotal} < bare ${report.bare.tokens.inputTotal} (−${report.deltas.inputTokenSavePct.toFixed(1)}%)`
)

if (okCompletion && okIntel && okTokens) {
  console.log('')
  console.log('Weak-efficiency bench PASS')
  process.exit(0)
}
console.log('')
console.log('Weak-efficiency bench FAIL')
process.exit(1)
