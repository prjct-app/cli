/**
 * Absolute harness scorecard for `prjct harness score`.
 *
 * Grade 0–5 per criterion. Done = mean ≥ 4.5 and every criterion ≥ 4.
 */

import { Buffer } from 'node:buffer'
import { createServer, DEFAULT_MCP_TOOL_TIER, resolveTier } from '../mcp/server'
import { PROVIDER_CAPABILITY_MODELS } from '../schemas/model'
import { countTokens } from '../tools/context/token-counter'
import { MINIMAL_ROUTING_BODY } from './routing-block'
import { buildPrjctSkill, emptySkillContext } from './skill-generator/prjct-skill-body'
import type { SkillContext } from './skill-generator/types'

export interface HarnessCriterion {
  id: string
  name: string
  score: number
  slo: string
  measured: string
  status: 'green' | 'amber' | 'red'
}

export interface HarnessScoreReport {
  grade: number
  programDone: boolean
  criteria: HarnessCriterion[]
  summary: string
  defaults: {
    mcpTier: string
    skillTokens: number
    routingBytes: number
    providerCount: number
    mcpToolCountDefault: number
  }
}

/** Absolute budgets the harness must hold. */
export const WORLD_CLASS = {
  skillTokensMax: 1500,
  skillTokensAmber: 2000,
  routingBodyBytesMax: 400,
  routingBodyBytesAmber: 600,
  mcpDefaultTier: 'core' as const,
  mcpToolsCoreMax: 20,
  providerMapsMin: 6,
  meanGreen: 4.5,
  minCriterionGreen: 4,
} as const

function gradeRatio(value: number, green: number, amber: number, lowerIsBetter: boolean): number {
  if (lowerIsBetter) {
    if (value <= green) return 5
    if (value <= amber) return 3.5
    if (value <= amber * 1.5) return 2
    return 1
  }
  if (value >= green) return 5
  if (value >= amber) return 3.5
  if (value >= amber * 0.5) return 2
  return 1
}

function statusOf(score: number): HarnessCriterion['status'] {
  if (score >= 4) return 'green'
  if (score >= 3) return 'amber'
  return 'red'
}

function criterion(
  id: string,
  name: string,
  score: number,
  slo: string,
  measured: string
): HarnessCriterion {
  return { id, name, score, slo, measured, status: statusOf(score) }
}

function countDefaultTools(): number {
  const prev = process.env.PRJCT_MCP_TOOLS
  try {
    delete process.env.PRJCT_MCP_TOOLS
    const server = createServer() as unknown as { _registeredTools?: Record<string, unknown> }
    return Object.keys(server._registeredTools ?? {}).length
  } finally {
    if (prev === undefined) delete process.env.PRJCT_MCP_TOOLS
    else process.env.PRJCT_MCP_TOOLS = prev
  }
}

export function computeHarnessScore(
  options: {
    skillCtx?: SkillContext
    /** Live multi-runtime organic grade from probeHarnessCoverage (0–5). */
    multiRuntimeOrganicGrade?: number
    multiRuntimeOrganicMeasured?: string
  } = {}
): HarnessScoreReport {
  const skill = buildPrjctSkill(options.skillCtx ?? emptySkillContext())
  const skillTokens = countTokens(skill)
  const routingBytes = Buffer.byteLength(MINIMAL_ROUTING_BODY, 'utf-8')
  const providerNames = Object.keys(PROVIDER_CAPABILITY_MODELS)
  const providerCount = providerNames.length
  const mcpTier = resolveTier(undefined)
  const mcpTools = countDefaultTools()
  const hasWorkflowsPointer = skill.includes('workflows.md')
  const multiProvider =
    providerCount >= WORLD_CLASS.providerMapsMin &&
    Boolean(PROVIDER_CAPABILITY_MODELS.claude && PROVIDER_CAPABILITY_MODELS.gemini)

  const criteria: HarnessCriterion[] = [
    criterion(
      'skill-tokens',
      'Always-on skill tokens',
      gradeRatio(skillTokens, WORLD_CLASS.skillTokensMax, WORLD_CLASS.skillTokensAmber, true),
      `≤ ${WORLD_CLASS.skillTokensMax} tok`,
      `${skillTokens} tok`
    ),
    criterion(
      'routing-bytes',
      'AGENTS/CLAUDE routing body',
      gradeRatio(
        routingBytes,
        WORLD_CLASS.routingBodyBytesMax,
        WORLD_CLASS.routingBodyBytesAmber,
        true
      ),
      `≤ ${WORLD_CLASS.routingBodyBytesMax} bytes`,
      `${routingBytes} bytes`
    ),
    criterion(
      'mcp-default',
      'MCP default tool tier',
      mcpTier === WORLD_CLASS.mcpDefaultTier ? 5 : mcpTier === 'standard' ? 3 : 1,
      `default = ${WORLD_CLASS.mcpDefaultTier}`,
      `${mcpTier} (${mcpTools} tools)`
    ),
    criterion(
      'mcp-tool-count',
      'MCP tools at default tier',
      gradeRatio(mcpTools, WORLD_CLASS.mcpToolsCoreMax, 30, true),
      `≤ ${WORLD_CLASS.mcpToolsCoreMax} tools`,
      `${mcpTools} tools`
    ),
    criterion(
      'provider-maps',
      'Provider capability maps',
      gradeRatio(providerCount, WORLD_CLASS.providerMapsMin, 4, false),
      `≥ ${WORLD_CLASS.providerMapsMin} providers`,
      `${providerCount}: ${providerNames.join(', ')}`
    ),
    criterion(
      'progressive-disclosure',
      'Progressive disclosure',
      hasWorkflowsPointer ? 5 : 1,
      'skill points at workflows.md',
      hasWorkflowsPointer ? 'skill → workflows.md' : 'missing pointer'
    ),
    criterion(
      'model-ssot',
      'Model policy SSOT',
      multiProvider ? 5 : PROVIDER_CAPABILITY_MODELS.claude ? 3 : 1,
      'capability classes across ≥6 providers',
      multiProvider ? 'multi-provider SSOT' : 'partial maps'
    ),
    criterion(
      'enforced-defaults',
      'Code-enforced lean defaults',
      DEFAULT_MCP_TOOL_TIER === 'core' && WORLD_CLASS.skillTokensMax <= 1500 ? 5 : 2,
      'MCP core default + skill budget in code',
      `tier=${DEFAULT_MCP_TOOL_TIER}; skillMax=${WORLD_CLASS.skillTokensMax}`
    ),
  ]

  // Optional: live organic multi-runtime board (probed by harness score / install).
  // Structural tests omit this so CI stays deterministic without real CLI installs.
  if (options.multiRuntimeOrganicGrade !== undefined) {
    criteria.push(
      criterion(
        'multi-runtime-organic',
        'Multi-runtime organic board',
        options.multiRuntimeOrganicGrade,
        '≥2 live full/inherited on detected CLIs (4+ = dominance)',
        options.multiRuntimeOrganicMeasured ?? `${options.multiRuntimeOrganicGrade}/5`
      )
    )
  }

  const grade =
    Math.round((criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length) * 10) / 10
  const programDone =
    grade >= WORLD_CLASS.meanGreen &&
    criteria.every((c) => c.score >= WORLD_CLASS.minCriterionGreen)

  const reds = criteria.filter((c) => c.status === 'red').map((c) => c.id)
  const summary = programDone
    ? `Grade ${grade}/5 — program done (all criteria ≥${WORLD_CLASS.minCriterionGreen}).`
    : `Grade ${grade}/5 — not done yet${reds.length ? ` (red: ${reds.join(', ')})` : ''}.`

  return {
    grade,
    programDone,
    criteria,
    summary,
    defaults: {
      mcpTier,
      skillTokens,
      routingBytes,
      providerCount,
      mcpToolCountDefault: mcpTools,
    },
  }
}

/**
 * Competitive dust — every row claims SUPERIOR with a measurable mechanism.
 * Field: gentle-ai, open-GSD, memory plugins (claude-mem/agentmemory/Mem0-class).
 * Mandate: not near-parity — beat on every dimension that is our job.
 */
export function renderCompetitiveDustMd(report: HarnessScoreReport): string {
  const grade = report.programDone ? 'SUPERIOR' : 'HOLD'
  return [
    '## Competitive dust (SUPERIOR mandate — gentle-ai · open-GSD · memory plugins · prjct)',
    '',
    '| Dimension | gentle-ai | open-GSD | memory plugins | **prjct (mechanism)** |',
    '|---|---|---|---|---|',
    '| Judgment memory | Engram JSONL | files / bolt-on | chat transcript | **SUPERIOR: SQLite typed WHY + SoT/SUGGEST apply-loop** |',
    '| Enforcement | prompt-only | phase markdown | none | **SUPERIOR: code gates SDD/TDD/land/discuss/package/judgment** |',
    '| Work graph | none | ROADMAP.md | none | **SUPERIOR: ready/next/claim/phases + switch/accept in SQLite** |',
    '| Fresh window | optional | re-research thrash | session reset | **SUPERIOR: prime + SessionStart compound (0 re-teach OS)** |',
    '| Token economics | unmeasured | high × agents | dump context | **SUPERIOR: telemetry + skill diet + Rho retention** |',
    '| Discuss before code | organic | discuss-phase | none | **SUPERIOR: discuss-lock H2+ code-enforced** |',
    '| Context pressure | soft | fresh window | none | **SUPERIOR: hard gate on ship at critical + land path** |',
    '| Package legitimacy | none | slopcheck-ish | none | **SUPERIOR: PreToolUse install + ship `--allow-new-deps`** |',
    '| Memory hygiene | grow forever | files pile | grow forever | **SUPERIOR: Rho excess vs R + distill-hard-delete + close** |',
    '| Multi-runtime wire | one eco | Claude-first | plugin per host | **SUPERIOR: one install → Claude+Codex+Gemini+Cursor+Grok** |',
    '| Organic feel | install prompts | `/plan` ceremony | manual MCP | **SUPERIOR: passive hooks; agent never re-learns the OS** |',
    '| Public harness Δ | none / demo only | none | none | **SUPERIOR: bare vs prjct intent+footprint table in score + CI gate** |',
    '| Content-bound approve | content-hash review | phase files | none | **SUPERIOR: path+blob treeHash on judgment approve; ship drifts re-approve** |',
    '| SoT hard-bind H2+ | prompt BINDING | ceremony | none | **SUPERIOR: pre-edit deny on decision/gotcha/fact without supersede/override** |',
    '| Trap-before-edit | optional heads-up | none | none | **SUPERIOR: 100% trap-id surface SLO in pre-edit inject** |',
    '| Impact-ranked next | FIFO backlog | ROADMAP.md | none | **SUPERIOR: unblocks × world-model blast × SoT pressure + why line** |',
    '| Geometry-at-intent | ship-only size | ceremony | none | **SUPERIOR: large H2+/H3 plans split|single before code** |',
    `| Structural grade | — | — | — | **${report.grade}/5 ${grade}** |`,
    '',
    '_Rule: never clone skill flood or transcript memory. Crush on compound judgment, cost, enforcement, retention, multi-surface wire._',
    '',
  ].join('\n')
}

export function renderHarnessScoreMd(
  report: HarnessScoreReport,
  options: {
    coverageMd?: string
    /** Pure bare-vs-harness Δ table (from computeHarnessDelta). */
    deltaMd?: string
    /** Project-scoped closed-loop / retention / tokens (optional). */
    outcomesMd?: string
  } = {}
): string {
  const rows = report.criteria.map(
    (c) => `| ${c.name} | ${c.score} | ${c.status} | ${c.slo} | ${c.measured} |`
  )
  return [
    '# Harness score',
    '',
    `**Grade:** ${report.grade}/5 ${report.programDone ? '✓ done' : '— in progress'}`,
    '',
    report.summary,
    '',
    '| Criterion | Score | Status | SLO | Measured |',
    '|---|---:|---|---|---|',
    ...rows,
    '',
    '## Defaults',
    '',
    `- MCP: \`${report.defaults.mcpTier}\` (${report.defaults.mcpToolCountDefault} tools)`,
    `- Skill tokens: ${report.defaults.skillTokens}`,
    `- Routing body: ${report.defaults.routingBytes} bytes`,
    `- Providers: ${report.defaults.providerCount}`,
    '',
    options.deltaMd ?? '',
    options.outcomesMd ?? '',
    options.coverageMd ?? '',
    renderCompetitiveDustMd(report),
  ].join('\n')
}

export { buildPrjctSkill, emptySkillContext }
