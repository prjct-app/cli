#!/usr/bin/env bun
/**
 * Weak-model efficiency + intelligence + token-cost bench.
 *
 * DEFAULT: live LLM (Claude Code / haiku) — requires `claude auth` logged in.
 * Fallback sim: pass --sim (deterministic, no network).
 *
 *   bun run bench:weak-efficiency
 *   bun run bench:weak-efficiency -- --sim
 *   PRJCT_LIVE_MODEL=haiku bun run bench:weak-efficiency -- --limit 5
 */

import {
  formatLiveEfficiencyMarkdown,
  runLiveEfficiencyBench,
} from '../core/services/live-efficiency-bench'
import {
  formatEfficiencyMarkdown,
  runEfficiencyBench,
} from '../core/services/weak-efficiency-bench'

const args = process.argv.slice(2)
const sim = args.includes('--sim') || process.env.PRJCT_BENCH_SIM === '1'
const limitIdx = args.indexOf('--limit')
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined

if (sim) {
  console.error('Mode: SIM (deterministic — not live LLM)\n')
  const report = runEfficiencyBench()
  console.log(formatEfficiencyMarkdown(report))
  const okCompletion = report.harness.completionRate >= report.bare.completionRate
  const okIntel = report.harness.intelligenceScore >= report.bare.intelligenceScore + 0.2
  const okTokens = report.harness.tokens.inputTotal < report.bare.tokens.inputTotal
  console.log('')
  console.log('## Gates (sim)')
  console.log(`${okCompletion ? '✓' : '✗'} completion`)
  console.log(`${okIntel ? '✓' : '✗'} intelligence +20pts`)
  console.log(`${okTokens ? '✓' : '✗'} fewer input tokens`)
  process.exit(okCompletion && okIntel && okTokens ? 0 : 1)
}

// ── Live path (default) ──────────────────────────────────────────────────────
console.error('Mode: LIVE LLM (default)\n')

try {
  const report = await runLiveEfficiencyBench({
    limit: Number.isFinite(limit) ? limit : undefined,
    model: process.env.PRJCT_LIVE_MODEL,
  })
  console.log(formatLiveEfficiencyMarkdown(report))

  const okCompletion = report.harness.completionRate >= report.bare.completionRate
  // Live gate: harness routing must beat bare by ≥10 pts OR absolute ≥70%
  const okIntel =
    report.harness.routingAccuracy >= report.bare.routingAccuracy + 0.1 ||
    report.harness.routingAccuracy >= 0.7

  console.log('')
  console.log('## Gates (live)')
  console.log(
    `${okCompletion ? '✓' : '✗'} completion: harness ${(report.harness.completionRate * 100).toFixed(0)}% ≥ bare ${(report.bare.completionRate * 100).toFixed(0)}%`
  )
  console.log(
    `${okIntel ? '✓' : '✗'} routing intelligence: harness ${(report.harness.routingAccuracy * 100).toFixed(0)}% (bare ${(report.bare.routingAccuracy * 100).toFixed(0)}%)`
  )
  console.log(
    `· cost bare $${report.bare.totalCostUsd.toFixed(4)} → harness $${report.harness.totalCostUsd.toFixed(4)} (${report.deltas.costSavePct.toFixed(1)}%)`
  )
  console.log(
    `· billable tokens bare ${report.bare.totalBillableTokens} → harness ${report.harness.totalBillableTokens} (${report.deltas.billableTokenSavePct.toFixed(1)}%)`
  )

  if (okCompletion && okIntel) {
    console.log('')
    console.log('Live weak-efficiency bench PASS')
    process.exit(0)
  }
  console.log('')
  console.log('Live weak-efficiency bench FAIL')
  process.exit(1)
} catch (err) {
  console.error(`Live bench failed: ${(err as Error).message}`)
  console.error('Fix: ensure `claude auth status` shows loggedIn, or re-run with --sim')
  process.exit(2)
}
