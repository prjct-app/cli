/**
 * Weak-model readiness + A/B vs frontier — release-blocking SLOs.
 *
 * North star: weak model + prjct ≥ frontier without harness on discipline
 * metrics (tokens, routing, intent verbs, structural grade). CI must stay green.
 *
 * Used by:
 *   - scripts/bench-weak-model.ts (CLI exit code)
 *   - core/__tests__/services/weak-model-bench.test.ts (CI gate)
 *   - weak-frontier-demo (public table shares intent fixtures)
 */

import { Buffer } from 'node:buffer'
import { getHarnessSurface, listHarnessSurfaces } from '../infrastructure/harness-surfaces'
import { DEFAULT_MCP_TOOL_TIER, resolveTier } from '../mcp/server'
import { PROVIDER_CAPABILITY_MODELS } from '../schemas/model'
import { countTokens } from '../tools/context/token-counter'
import { computeHarnessScore, WORLD_CLASS } from './harness-score'
import {
  applyEvidenceTax,
  buildNextAction,
  findingDna,
  judgmentShipVerdict,
} from './precision-judgment'
import { MINIMAL_ROUTING_BODY } from './routing-block'
import { buildPrjctSkill, emptySkillContext } from './skill-generator/prjct-skill-body'
import { buildDemoRows, routeIntent, routeIntentBare } from './weak-frontier-demo'

export interface WeakBenchCheck {
  name: string
  ok: boolean
  detail: string
}

export interface WeakBenchReport {
  checks: WeakBenchCheck[]
  passed: number
  total: number
  allGreen: boolean
  summary: string
}

export const INTENT_FIXTURES: ReadonlyArray<{ signal: string; verb: string }> = [
  { signal: 'sync the project', verb: 'sync' },
  { signal: 'search for auth decisions', verb: 'search' },
  { signal: 'remember this decision about caching', verb: 'remember' },
  { signal: 'fix the login bug', verb: 'work' },
  { signal: 'what should I work on next', verb: 'next' },
  { signal: 'ship the feature', verb: 'ship' },
  { signal: 'implement rate limiting', verb: 'work' },
  { signal: 'find gotchas on migrations', verb: 'search' },
  { signal: 'recall package legitimacy rules', verb: 'search' },
  { signal: 'open a pr for the fix', verb: 'ship' },
] as const

/** Absolute minimum checks that must stay green for release. */
export const WEAK_BENCH_MIN_PASS = 15

/**
 * Run every weak-model + A/B structural check (pure, no network, no disk install).
 */
export function runWeakModelBench(): WeakBenchReport {
  const checks: WeakBenchCheck[] = []
  const push = (name: string, ok: boolean, detail: string) => {
    checks.push({ name, ok, detail })
  }

  const skillTok = countTokens(buildPrjctSkill(emptySkillContext()))
  push(
    'skill always-on',
    skillTok <= WORLD_CLASS.skillTokensMax,
    `${skillTok} tok (max ${WORLD_CLASS.skillTokensMax})`
  )

  const routingB = Buffer.byteLength(MINIMAL_ROUTING_BODY, 'utf-8')
  push(
    'routing body',
    routingB <= WORLD_CLASS.routingBodyBytesMax,
    `${routingB} bytes (max ${WORLD_CLASS.routingBodyBytesMax})`
  )

  push(
    'MCP default',
    resolveTier(undefined) === 'core' && DEFAULT_MCP_TOOL_TIER === 'core',
    `tier=${resolveTier(undefined)}`
  )

  const providers = Object.keys(PROVIDER_CAPABILITY_MODELS).length
  push(
    'provider maps',
    providers >= WORLD_CLASS.providerMapsMin,
    `${providers} providers (min ${WORLD_CLASS.providerMapsMin})`
  )

  const score = computeHarnessScore()
  push(
    'harness score',
    score.programDone && score.grade >= 4.5,
    `grade ${score.grade}/5 done=${score.programDone}`
  )

  push(
    'MCP tool surface',
    score.defaults.mcpToolCountDefault <= WORLD_CLASS.mcpToolsCoreMax,
    `${score.defaults.mcpToolCountDefault} tools at default`
  )

  let harnessHits = 0
  let bareHits = 0
  for (const f of INTENT_FIXTURES) {
    const got = routeIntent(f.signal)
    const bare = routeIntentBare(f.signal)
    const ok = got === f.verb
    if (ok) harnessHits++
    if (bare === f.verb) bareHits++
    push(`intent:${f.verb}`, ok, `"${f.signal}" → ${got}`)
  }

  const harnessRate = harnessHits / INTENT_FIXTURES.length
  const bareRate = bareHits / INTENT_FIXTURES.length
  push(
    'intent routing accuracy',
    harnessRate >= 0.95,
    `${Math.round(harnessRate * 100)}% (need ≥95%)`
  )
  push(
    'intent A/B beats bare',
    harnessHits > bareHits,
    `harness ${harnessHits}/${INTENT_FIXTURES.length} vs bare ${bareHits}/${INTENT_FIXTURES.length} (${Math.round(bareRate * 100)}%)`
  )

  const demo = buildDemoRows()
  const demoFail = demo.filter((r) => !r.weakOk)
  push(
    'weak-vs-frontier demo',
    demoFail.length === 0,
    `${demo.length - demoFail.length}/${demo.length} demo SLOs`
  )

  // Multi-runtime wire is structural (adapters exist) — not live disk probe
  // (CI runners don't install Claude/Codex). Proves the moat ship surface.
  const codex = getHarnessSurface('codex')
  const gemini = getHarnessSurface('gemini')
  const cursor = getHarnessSurface('cursor')
  const grok = getHarnessSurface('grok')
  push(
    'codex hooks+MCP native',
    codex?.hooks.prjct === 'native' && codex?.mcp.prjct === 'native',
    `hooks=${codex?.hooks.prjct} mcp=${codex?.mcp.prjct}`
  )
  push(
    'gemini hooks+MCP native',
    gemini?.hooks.prjct === 'native' && gemini?.mcp.prjct === 'native',
    `hooks=${gemini?.hooks.prjct} mcp=${gemini?.mcp.prjct}`
  )
  push('cursor hooks native', cursor?.hooks.prjct === 'native', `hooks=${cursor?.hooks.prjct}`)
  push(
    'grok inherits-claude',
    grok?.hooks.prjct === 'inherits-claude' && grok?.mcp.prjct === 'inherits-claude',
    `hooks=${grok?.hooks.prjct} mcp=${grok?.mcp.prjct}`
  )

  const surfaceIds = new Set(listHarnessSurfaces().map((s) => s.runtimeId))
  push(
    'benchmark surface matrix',
    ['claude', 'codex', 'gemini', 'grok', 'cursor'].every((id) => surfaceIds.has(id as never)),
    `${surfaceIds.size} surfaces in matrix`
  )

  // Precision judgment v2 — structural dominance vs gentle-ai 4R prose
  {
    const tax = applyEvidenceTax({
      id: 't',
      severity: 'blocker',
      status: 'candidate',
      title: 'vibes only',
    })
    push(
      'judgment evidence tax',
      tax.severity === 'critical',
      `blocker-without-locus → ${tax.severity}`
    )
    const ship = judgmentShipVerdict({
      codeStrict: true,
      intensity: 'full',
      ledger: null,
      override: false,
    })
    push(
      'judgment ship teeth',
      ship.blocked && ship.mode === 'hard',
      `code-strict full without ledger blocked=${ship.blocked}`
    )
    const next = buildNextAction(null, 'full')
    push(
      'judgment next card',
      next.kind === 'open_ledger' && Boolean(next.judgeCharters?.red),
      `kind=${next.kind} has RED charter`
    )
    const dnaA = findingDna({ title: 'Auth hole', file: 'a.ts', line: 10 })
    const dnaB = findingDna({ title: 'auth hole!', file: 'a.ts', line: 12 })
    push('judgment DNA stable', dnaA === dnaB, dnaA)
  }

  const passed = checks.filter((c) => c.ok).length
  const total = checks.length
  const allGreen = passed === total && total >= WEAK_BENCH_MIN_PASS
  const summary = allGreen
    ? `Weak-model A/B PASS (${passed}/${total}) — release gate green`
    : `Weak-model A/B FAIL (${passed}/${total}) — red: ${checks
        .filter((c) => !c.ok)
        .map((c) => c.name)
        .join(', ')}`

  return { checks, passed, total, allGreen, summary }
}

export function formatWeakBenchMarkdown(report: WeakBenchReport): string {
  const lines = [
    '# Weak-model A/B (release gate)',
    '',
    report.summary,
    '',
    '| Check | Detail | Pass |',
    '|---|---|:---:|',
  ]
  for (const c of report.checks) {
    lines.push(`| ${c.name} | ${c.detail} | ${c.ok ? '✓' : '✗'} |`)
  }
  lines.push('')
  lines.push('Reproduce: `bun run bench:weak-model` · `bun run demo:weak-vs-frontier`')
  return lines.join('\n')
}
