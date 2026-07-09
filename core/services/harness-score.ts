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

export function computeHarnessScore(options: { skillCtx?: SkillContext } = {}): HarnessScoreReport {
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
 * Competitive dust table — absolute dimensions where prjct must stay above
 * gentle-ai (prompt-only ecosystem) and open-GSD (markdown phase theater).
 * Static capability matrix + live structural grade; not marketing fluff.
 */
export function renderCompetitiveDustMd(report: HarnessScoreReport): string {
  const grade = report.programDone ? 'WIN' : 'HOLD'
  return [
    '## Competitive dust (gentle-ai · open-GSD · prjct)',
    '',
    '| Dimension | gentle-ai | open-GSD | **prjct** |',
    '|---|---|---|---|',
    '| Judgment memory | Engram JSONL | files / MemPalace bolt-on | **SQLite typed WHY + apply-loop** |',
    '| Enforcement | prompt-only | phase markdown ritual | **code gates (SDD/TDD/land/discuss/package)** |',
    '| Work graph | none | ROADMAP.md | **ready/next/claim/phases in SQLite** |',
    '| Fresh window | optional | re-research every phase | **prime + SessionStart digest (compound)** |',
    '| Token economics | unmeasured thrash | high (fresh windows × agents) | **telemetry + skill/MCP diet** |',
    '| Discuss before code | organic SDD | discuss-phase command | **discuss-lock H2+ (code)** |',
    '| Install surface | curl/brew binary | npx multi-runtime | npm/pnpm/brew + upgrade consolidate |',
    `| Structural grade | n/a | n/a | **${report.grade}/5 ${grade}** |`,
    '',
    '_Rule: never clone their skill count or `.planning/` OS. Crush on compound judgment, cost, and enforcement._',
    '',
  ].join('\n')
}

export function renderHarnessScoreMd(report: HarnessScoreReport): string {
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
    renderCompetitiveDustMd(report),
  ].join('\n')
}

export { buildPrjctSkill, emptySkillContext }
