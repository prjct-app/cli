/**
 * Retrieval eval CLI — prints the baseline Recall@k / MRR / nDCG@k for a
 * project's recall pipeline over its own ledger pairs, with a leak-free
 * temporal split. This is the yardstick: run it before and after any retrieval
 * change (encoder swap, reranker) to prove the change with a number.
 *
 *   bun run scripts/eval-retrieval.mjs <projectId> [k]
 *
 * Pass a provider in code (evalProvider) to compare a candidate encoder against
 * the LocalSubwordEmbeddingProvider baseline on the SAME pairs.
 */

import { LocalSubwordEmbeddingProvider } from '../services/embeddings'
import { exportLedgerPairs, temporalSplit } from './ledger-pairs'
import { evalBm25, evalProvider } from './retrieval-eval'
import {
  type AggregateMetrics,
  evaluateImprovementGate,
  type ImprovementGateResult,
} from './retrieval-metrics'

interface TimedMetrics {
  metrics: AggregateMetrics
  ms: number
}

function elapsedMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1_000_000
}

function fmt(m: TimedMetrics): string {
  const p = (x: number) => (x * 100).toFixed(1).padStart(5)
  return (
    `n=${String(m.metrics.queries).padStart(3)}  ` +
    `Recall@${m.metrics.k}=${p(m.metrics.recallAtK)}%  ` +
    `MRR=${p(m.metrics.mrr)}%  ` +
    `nDCG@${m.metrics.k}=${p(m.metrics.ndcgAtK)}%  ` +
    `wall=${m.ms.toFixed(1)}ms`
  )
}

function fmtLift(value: number): string {
  if (value === Number.POSITIVE_INFINITY) return '+∞'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function fmtGate(gate: ImprovementGateResult): string {
  const primary = gate.lifts.find((l) => l.metric === gate.primaryMetric)
  const lift = primary ? fmtLift(primary.relativeLift) : 'n/a'
  const status = gate.passed ? 'PASS' : 'FAIL'
  const blockers = gate.blockers.length > 0 ? ` — ${gate.blockers.join('; ')}` : ''
  const remaining = Math.max(0, gate.minCases - gate.sampleCount)
  const target = `${(gate.requiredPrimaryValue * 100).toFixed(1)}%`
  const next =
    remaining > 0
      ? `; need ${remaining} more labeled pairs`
      : `; candidate ${gate.primaryMetric} target ${target}`
  return `${status} (${gate.primaryMetric} lift ${lift}, required +${(gate.minRelativeLift * 100).toFixed(0)}%, sample ${gate.sampleCount}/${gate.minCases}${next})${blockers}`
}

export async function runEval(projectId: string, k = 10): Promise<void> {
  const { entries, pairs } = exportLedgerPairs(projectId)
  const split = temporalSplit(pairs, 0.2)
  const bySource = pairs.reduce<Record<string, number>>((acc, pair) => {
    const source = pair.source ?? 'reference-edge'
    acc[source] = (acc[source] ?? 0) + 1
    return acc
  }, {})

  console.log(`\n=== Retrieval baseline · project ${projectId} ===`)
  console.log(`corpus entries (model-worthy): ${entries.length}`)
  console.log(`labeled ledger pairs:          ${pairs.length}`)
  console.log(
    `label sources:                 ${Object.entries(bySource)
      .map(([source, n]) => `${source}=${n}`)
      .join(', ')}`
  )
  console.log('cost profile:                  local CPU + SQLite; no LLM/API tokens by default')
  console.log(`temporal split @ ${split.cutoff || 'n/a'}`)
  console.log(`  train: ${split.train.length}   eval(held-out): ${split.evalSet.length}\n`)

  const local = new LocalSubwordEmbeddingProvider()

  // Score the FULL pair set (more signal at this small volume) and the held-out
  // eval set (the honest, leak-free number) side by side.
  for (const [label, set] of [
    ['ALL pairs', pairs],
    ['EVAL (held-out)', split.evalSet],
  ] as const) {
    if (set.length === 0) {
      console.log(`${label.padEnd(18)} — empty, skipped`)
      continue
    }
    const bm25Start = process.hrtime.bigint()
    const bm25 = { metrics: evalBm25(projectId, set, k), ms: elapsedMs(bm25Start) }
    const hashingStart = process.hrtime.bigint()
    const hashing = {
      metrics: await evalProvider(entries, set, local, k),
      ms: elapsedMs(hashingStart),
    }
    console.log(`${label}`)
    console.log(`  BM25 (FTS5)      ${fmt(bm25)}`)
    console.log(`  hashing (local)  ${fmt(hashing)}`)
    console.log(
      `  gate             ${fmtGate(evaluateImprovementGate(bm25.metrics, hashing.metrics))}`
    )
    console.log('')
  }
  console.log('Drop a pretrained ONNX provider into evalProvider() to compare on the same pairs.\n')
}
