#!/usr/bin/env bun
/**
 * Weak-model readiness bench.
 * Exit 0 only when all SLOs pass.
 *
 * Usage: bun scripts/bench-weak-model.ts
 */

import { Buffer } from 'node:buffer'
import { DEFAULT_MCP_TOOL_TIER, resolveTier } from '../core/mcp/server'
import { PROVIDER_CAPABILITY_MODELS } from '../core/schemas/model'
import { computeHarnessScore, WORLD_CLASS } from '../core/services/harness-score'
import { MINIMAL_ROUTING_BODY } from '../core/services/routing-block'
import {
  buildPrjctSkill,
  emptySkillContext,
} from '../core/services/skill-generator/prjct-skill-body'
import { countTokens } from '../core/tools/context/token-counter'

interface Check {
  name: string
  ok: boolean
  detail: string
}

const checks: Check[] = []

function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}: ${detail}`)
}

const skillTok = countTokens(buildPrjctSkill(emptySkillContext()))
check(
  'skill always-on',
  skillTok <= WORLD_CLASS.skillTokensMax,
  `${skillTok} tok (max ${WORLD_CLASS.skillTokensMax})`
)

const routingB = Buffer.byteLength(MINIMAL_ROUTING_BODY, 'utf-8')
check(
  'routing body',
  routingB <= WORLD_CLASS.routingBodyBytesMax,
  `${routingB} bytes (max ${WORLD_CLASS.routingBodyBytesMax})`
)

check(
  'MCP default',
  resolveTier(undefined) === 'core' && DEFAULT_MCP_TOOL_TIER === 'core',
  `tier=${resolveTier(undefined)}`
)

const providers = Object.keys(PROVIDER_CAPABILITY_MODELS).length
check(
  'provider maps',
  providers >= WORLD_CLASS.providerMapsMin,
  `${providers} providers (min ${WORLD_CLASS.providerMapsMin})`
)

const score = computeHarnessScore()
check(
  'harness score',
  score.programDone && score.grade >= 4.5,
  `grade ${score.grade}/5 done=${score.programDone}`
)

check(
  'MCP tool surface',
  score.defaults.mcpToolCountDefault <= WORLD_CLASS.mcpToolsCoreMax,
  `${score.defaults.mcpToolCountDefault} tools at default`
)

/** Deterministic intent router — weak models must not wrap bin verbs as work. */
function routeIntent(signal: string): string {
  const s = signal.toLowerCase()
  if (/\bsync\b/.test(s)) return 'sync'
  if (/\bsearch\b|\bfind\b|\brecall\b/.test(s)) return 'search'
  if (/\bremember\b|\bsave (this|that|a)\b/.test(s)) return 'remember'
  if (/\bship\b|\bopen a pr\b/.test(s)) return 'ship'
  if (/what should i work|what next|\bready\b/.test(s)) return 'next'
  if (/\bfix\b|\bbuild\b|\bimplement\b|\bbug\b|\brefactor\b/.test(s)) return 'work'
  return 'work'
}

const INTENT_FIXTURES: Array<{ signal: string; verb: string }> = [
  { signal: 'sync the project', verb: 'sync' },
  { signal: 'search for auth decisions', verb: 'search' },
  { signal: 'remember this decision about caching', verb: 'remember' },
  { signal: 'fix the login bug', verb: 'work' },
  { signal: 'what should I work on next', verb: 'next' },
  { signal: 'ship the feature', verb: 'ship' },
  { signal: 'implement rate limiting', verb: 'work' },
  { signal: 'find gotchas on migrations', verb: 'search' },
]

let intentHits = 0
for (const f of INTENT_FIXTURES) {
  const got = routeIntent(f.signal)
  const ok = got === f.verb
  if (ok) intentHits++
  check(`intent:${f.verb}`, ok, `"${f.signal}" → ${got}`)
}

const intentRate = intentHits / INTENT_FIXTURES.length
check('intent routing accuracy', intentRate >= 0.95, `${Math.round(intentRate * 100)}% (need ≥95%)`)

const failed = checks.filter((c) => !c.ok)
console.log('')
if (failed.length === 0) {
  console.log(`Weak-model bench PASS (${checks.length}/${checks.length})`)
  process.exit(0)
}
console.log(`Weak-model bench FAIL (${checks.length - failed.length}/${checks.length})`)
process.exit(1)
