#!/usr/bin/env bun
/**
 * Weak-model readiness bench — structural proof that the harness stays lean
 * enough for a cheap brain to carry a session.
 *
 * North star: weak-model + prjct ≥ good-model alone (cadence + discipline).
 * This script measures what we can without an LLM API call.
 *
 * Usage: bun scripts/bench-weak-model.ts
 * Exit 0 only when all SLOs pass.
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
  const mark = ok ? '✓' : '✗'
  console.log(`${mark} ${name}: ${detail}`)
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

// Weak models drown in tool schema — core surface must stay small.
check(
  'MCP tool surface',
  score.defaults.mcpToolCountDefault <= WORLD_CLASS.mcpToolsCoreMax,
  `${score.defaults.mcpToolCountDefault} tools at default`
)

const failed = checks.filter((c) => !c.ok)
console.log('')
if (failed.length === 0) {
  console.log(`Weak-model bench PASS (${checks.length}/${checks.length})`)
  process.exit(0)
}
console.log(`Weak-model bench FAIL (${checks.length - failed.length}/${checks.length})`)
process.exit(1)
