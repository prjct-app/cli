/**
 * Pure retrieval-quality metrics — the honest yardstick for any change to the
 * recall pipeline (hashing embeddings → pretrained encoder, rerankers, etc.).
 *
 * Every function takes a RANKED list of candidate ids (best-first) and the SET
 * of ids that are actually relevant for that query, and returns a scalar. No
 * I/O, no DB, no provider — so they unit-test trivially and can score the
 * output of any retriever (BM25, semantic, blended) identically.
 */

/** Rank (1-indexed) of the first relevant id in `ranked`, or 0 if none. */
export function firstRelevantRank(ranked: string[], relevant: ReadonlySet<string>): number {
  for (let i = 0; i < ranked.length; i++) {
    if (relevant.has(ranked[i])) return i + 1
  }
  return 0
}

/** Fraction of relevant ids found within the top `k`. Single-relevant → 0/1. */
export function recallAtK(ranked: string[], relevant: ReadonlySet<string>, k: number): number {
  if (relevant.size === 0) return 0
  const top = ranked.slice(0, k)
  let hit = 0
  for (const id of top) if (relevant.has(id)) hit++
  return hit / relevant.size
}

/** Reciprocal rank of the first relevant hit (0 if none in the list). */
export function reciprocalRank(ranked: string[], relevant: ReadonlySet<string>): number {
  const r = firstRelevantRank(ranked, relevant)
  return r === 0 ? 0 : 1 / r
}

/**
 * Binary-relevance nDCG@k. DCG sums 1/log2(rank+1) over relevant hits in the
 * top-k; IDCG is the same with all relevants packed at the front. Returns a
 * value in [0,1] where 1 = every relevant id ranked above every irrelevant.
 */
export function ndcgAtK(ranked: string[], relevant: ReadonlySet<string>, k: number): number {
  if (relevant.size === 0) return 0
  let dcg = 0
  const top = ranked.slice(0, k)
  for (let i = 0; i < top.length; i++) {
    if (relevant.has(top[i])) dcg += 1 / Math.log2(i + 2)
  }
  const ideal = Math.min(relevant.size, k)
  let idcg = 0
  for (let i = 0; i < ideal; i++) idcg += 1 / Math.log2(i + 2)
  return idcg === 0 ? 0 : dcg / idcg
}

export interface AggregateMetrics {
  /** Number of (query, relevant-set) cases scored. */
  queries: number
  recallAtK: number
  mrr: number
  ndcgAtK: number
  k: number
}

export type RetrievalMetricKey = 'recallAtK' | 'mrr' | 'ndcgAtK'

export interface MetricLift {
  metric: RetrievalMetricKey
  baseline: number
  candidate: number
  absoluteDelta: number
  /** Relative lift over baseline; Infinity means baseline was zero and candidate improved. */
  relativeLift: number
}

export interface ImprovementGateOptions {
  /** Minimum labeled cases before the comparison is decision-grade. */
  minCases?: number
  /** Required relative lift on the primary metric. 0.2 = +20%. */
  minRelativeLift?: number
  /** The metric that must clear the configured lift threshold. */
  primaryMetric?: RetrievalMetricKey
  /** Metrics that must not regress. Defaults to every aggregate metric. */
  guardMetrics?: RetrievalMetricKey[]
}

export interface ImprovementGateResult {
  passed: boolean
  sampleOk: boolean
  sampleCount: number
  minCases: number
  minRelativeLift: number
  primaryMetric: RetrievalMetricKey
  requiredPrimaryValue: number
  lifts: MetricLift[]
  blockers: string[]
}

/**
 * Mean Recall@k, MRR and nDCG@k over a batch of ranked results. Each case is a
 * ranked id list plus its relevant set — typically one per labeled ledger pair.
 */
export function aggregate(
  cases: Array<{ ranked: string[]; relevant: ReadonlySet<string> }>,
  k: number
): AggregateMetrics {
  if (cases.length === 0) return { queries: 0, recallAtK: 0, mrr: 0, ndcgAtK: 0, k }
  let recall = 0
  let mrr = 0
  let ndcg = 0
  for (const c of cases) {
    recall += recallAtK(c.ranked, c.relevant, k)
    mrr += reciprocalRank(c.ranked, c.relevant)
    ndcg += ndcgAtK(c.ranked, c.relevant, k)
  }
  const n = cases.length
  return { queries: n, recallAtK: recall / n, mrr: mrr / n, ndcgAtK: ndcg / n, k }
}

function metricLift(
  metric: RetrievalMetricKey,
  baseline: AggregateMetrics,
  candidate: AggregateMetrics
): MetricLift {
  const base = baseline[metric]
  const next = candidate[metric]
  const absoluteDelta = next - base
  return {
    metric,
    baseline: base,
    candidate: next,
    absoluteDelta,
    relativeLift: base === 0 ? (next > 0 ? Number.POSITIVE_INFINITY : 0) : absoluteDelta / base,
  }
}

/**
 * Decision gate for retrieval changes. A candidate is only accepted when the
 * eval set is large enough, the primary metric clears the required relative
 * lift, and no guarded metric regresses against current behavior.
 */
export function evaluateImprovementGate(
  baseline: AggregateMetrics,
  candidate: AggregateMetrics,
  options: ImprovementGateOptions = {}
): ImprovementGateResult {
  const minCases = options.minCases ?? 100
  const minRelativeLift = options.minRelativeLift ?? 0.2
  const primaryMetric = options.primaryMetric ?? 'ndcgAtK'
  const guardMetrics = options.guardMetrics ?? ['recallAtK', 'mrr', 'ndcgAtK']
  const sampleCount = Math.min(baseline.queries, candidate.queries)
  const sampleOk = sampleCount >= minCases
  const metrics = Array.from(new Set<RetrievalMetricKey>([primaryMetric, ...guardMetrics]))
  const lifts = metrics.map((m) => metricLift(m, baseline, candidate))
  const blockers: string[] = []

  if (!sampleOk) blockers.push(`sample ${sampleCount}/${minCases}`)

  const primary = lifts.find((l) => l.metric === primaryMetric)
  const requiredPrimaryValue = baseline[primaryMetric] * (1 + minRelativeLift)
  if (!primary || primary.absoluteDelta <= 0 || primary.relativeLift < minRelativeLift) {
    blockers.push(`${primaryMetric} lift below ${(minRelativeLift * 100).toFixed(0)}%`)
  }

  for (const lift of lifts) {
    if (guardMetrics.includes(lift.metric) && lift.absoluteDelta < 0) {
      blockers.push(`${lift.metric} regressed`)
    }
  }

  return {
    passed: blockers.length === 0,
    sampleOk,
    sampleCount,
    minCases,
    minRelativeLift,
    primaryMetric,
    requiredPrimaryValue,
    lifts,
    blockers,
  }
}
