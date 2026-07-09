#!/usr/bin/env bun
/**
 * Weak-model readiness bench — exit 0 only when all SLOs pass.
 * Logic SSOT: core/services/weak-model-bench.ts
 *
 * Usage: bun scripts/bench-weak-model.ts
 */

import { formatWeakBenchMarkdown, runWeakModelBench } from '../core/services/weak-model-bench'

const report = runWeakModelBench()

for (const c of report.checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`)
}
console.log('')
console.log(report.summary)

if (process.argv.includes('--md')) {
  console.log('')
  console.log(formatWeakBenchMarkdown(report))
}

process.exit(report.allGreen ? 0 : 1)
