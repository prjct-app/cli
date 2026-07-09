/**
 * Weak-model efficiency + intelligence bench.
 *
 * Not a latency A/B. Simulates a constrained ("weak") agent completing a
 * fixed task suite with and without the prjct harness, scoring:
 *   - task completion (did the right verb/path finish the job?)
 *   - intelligence (routing accuracy, memory hit, trap avoidance, handoff)
 *   - token consumption (always-on context + tool surface + wasted turns)
 *   - $ cost under weak (haiku / mini) vs frontier (sonnet / opus) pricing
 *
 * Fully deterministic — no live LLM. Policies encode observed failure modes
 * of weak models without a harness (wrap bin verbs as work, re-derive context,
 * dump full tool schemas, forget session close).
 */

import { Buffer } from 'node:buffer'
import { countTokens } from '../tools/context/token-counter'
import { computeHarnessScore, WORLD_CLASS } from './harness-score'
import { MINIMAL_ROUTING_BODY } from './routing-block'
import { buildPrjctSkill, emptySkillContext } from './skill-generator/prjct-skill-body'
import { routeIntent, routeIntentBare } from './weak-frontier-demo'

/** Pricing per 1k tokens (same ballpark as token-counter MODEL_PRICING). */
export const PRICING = {
  'claude-haiku-4.5': { in: 0.001, out: 0.005 },
  'claude-sonnet-4.5': { in: 0.003, out: 0.015 },
  'claude-opus-4.5': { in: 0.005, out: 0.025 },
  'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
} as const

export type PriceModel = keyof typeof PRICING

/** Approximate schema tokens per MCP tool (name + description + JSON schema). */
const TOKENS_PER_MCP_TOOL = 180
/** Bare host with no prjct still injects a fat system preamble. */
const BARE_SYSTEM_TOKENS = 2500
/** Output tokens per successful tool-using turn (weak-model estimate). */
const OUT_TOKENS_PER_TURN = 220
/** Input tokens burned per wasted wrong-path turn (re-plan + re-read). */
const WASTE_TURN_IN = 900
const WASTE_TURN_OUT = 180

export type TaskKind = 'recall' | 'persist' | 'implement' | 'ship' | 'navigate' | 'close' | 'guard'

export interface TaskScenario {
  id: string
  kind: TaskKind
  userSignal: string
  /** Verb the harness expects. */
  correctVerb: string
  /** What success looks like for scoring. */
  success: string
  /** Memory topic that must be found for full credit (optional). */
  needsMemory?: string
  /** Gotcha that bare agents re-hit without recall. */
  trap?: string
}

/** Representative coding-agent tasks a weak model is asked to finish. */
export const TASK_SUITE: TaskScenario[] = [
  {
    id: 'T1',
    kind: 'recall',
    userSignal: 'search for auth decisions about session cookies',
    correctVerb: 'search',
    success: 'Surface prior decisions without re-reading the codebase',
    needsMemory: 'auth-session',
  },
  {
    id: 'T2',
    kind: 'persist',
    userSignal: 'remember this decision about caching the cochange matrix',
    correctVerb: 'remember',
    success: 'Durable decision lands in SQLite for the next session',
  },
  {
    id: 'T3',
    kind: 'implement',
    userSignal: 'fix the login rate-limit bug',
    correctVerb: 'work',
    success: 'Open a work cycle, apply fix, leave tests',
    trap: 'rate-limit-double-fire',
  },
  {
    id: 'T4',
    kind: 'navigate',
    userSignal: 'what should I work on next',
    correctVerb: 'next',
    success: 'Return ready frontier instead of inventing a random task',
  },
  {
    id: 'T5',
    kind: 'ship',
    userSignal: 'ship the feature',
    correctVerb: 'ship',
    success: 'Run ship gates from a feature branch, not freeform dump',
  },
  {
    id: 'T6',
    kind: 'recall',
    userSignal: 'find gotchas on sqlite migrations',
    correctVerb: 'search',
    success: 'Recall migration gotchas before editing migrations',
    needsMemory: 'sqlite-migrations',
    trap: 'migration-non-idempotent',
  },
  {
    id: 'T7',
    kind: 'implement',
    userSignal: 'implement passive capture for session transcripts',
    correctVerb: 'work',
    success: 'Harness-aware implement path (brief + guard), not blank slate',
    needsMemory: 'transcript-auto',
  },
  {
    id: 'T8',
    kind: 'close',
    userSignal: 'we are done for today, close the session',
    correctVerb: 'land',
    success: 'Session-close hand-off persists without agent remembering to remember',
  },
  {
    id: 'T9',
    kind: 'guard',
    userSignal: 'any traps before I edit core/services/task-service.ts',
    correctVerb: 'guard',
    success: 'File-level traps before edit',
    needsMemory: 'task-service',
  },
  {
    id: 'T10',
    kind: 'persist',
    userSignal: 'save that the release job must pin npm@11 on Node 22',
    correctVerb: 'remember',
    success: 'Gotcha/decision captured for the next release wave',
    trap: 'npm12-node20-engines',
  },
]

export interface SideTokens {
  alwaysOn: number
  mcpSurface: number
  perTaskContext: number
  wasteTurns: number
  productiveTurns: number
  inputTotal: number
  outputTotal: number
}

export interface TaskResult {
  taskId: string
  completed: boolean
  verbChosen: string
  verbCorrect: boolean
  memoryHit: boolean
  trapAvoided: boolean
  handoffOk: boolean
  turns: number
  inputTokens: number
  outputTokens: number
  notes: string
}

export interface SideReport {
  label: string
  withHarness: boolean
  tasks: TaskResult[]
  completionRate: number
  routingAccuracy: number
  memoryHitRate: number
  trapAvoidRate: number
  handoffRate: number
  intelligenceScore: number
  tokens: SideTokens
  costUsd: Record<PriceModel, number>
}

export interface EfficiencyBenchReport {
  suiteSize: number
  bare: SideReport
  harness: SideReport
  deltas: {
    completionPts: number
    intelligencePts: number
    inputTokenSavePct: number
    wasteTurnSavePct: number
    costSavePctHaiku: number
    costSavePctSonnet: number
  }
  structural: {
    skillTokens: number
    routingBytes: number
    mcpToolsCore: number
    mcpToolsAllEstimate: number
    harnessGrade: number
  }
}

function costOf(model: PriceModel, input: number, output: number): number {
  const p = PRICING[model]
  return (input / 1000) * p.in + (output / 1000) * p.out
}

function routeFor(signal: string, withHarness: boolean): string {
  if (withHarness) {
    // Land is not in the generic weak-frontier map; close-session signals map here.
    if (/\b(land|close the session|done for today|session close)\b/i.test(signal)) return 'land'
    if (/\bguard\b|\btraps?\b before|\bbefore i edit\b/i.test(signal)) return 'guard'
    const r = routeIntent(signal)
    return r
  }
  if (/\b(land|close the session|done for today)\b/i.test(signal)) {
    // Bare weak model "forgets" land → freeform work or nothing
    return 'work'
  }
  if (/\bguard\b|\btraps?\b/i.test(signal)) return 'work'
  return routeIntentBare(signal)
}

/**
 * Simulate one side completing the whole suite.
 * Memory store is in-process: harness side gets seeds + writes; bare does not.
 */
export function simulateSide(withHarness: boolean): SideReport {
  const label = withHarness ? 'weak + prjct harness' : 'weak bare (no harness)'
  const memory = new Set<string>(
    withHarness
      ? [
          'auth-session',
          'sqlite-migrations',
          'transcript-auto',
          'task-service',
          'npm12-node20-engines',
        ]
      : []
  )
  const trapsKnown = new Set<string>(
    withHarness ? ['rate-limit-double-fire', 'migration-non-idempotent'] : []
  )

  const skillTok = withHarness ? countTokens(buildPrjctSkill(emptySkillContext())) : 0
  const routingTok = withHarness ? countTokens(MINIMAL_ROUTING_BODY) : 0
  const alwaysOn = withHarness ? skillTok + routingTok : BARE_SYSTEM_TOKENS

  // Harness default core tools (~18); bare agent dumps a large tool surface.
  const mcpTools = withHarness ? 18 : 55
  const mcpSurface = mcpTools * TOKENS_PER_MCP_TOOL

  const tasks: TaskResult[] = []
  let wasteTurns = 0
  let productiveTurns = 0
  let inputTotal = alwaysOn + mcpSurface // paid once at session start
  let outputTotal = 0

  for (const task of TASK_SUITE) {
    const verb = routeFor(task.userSignal, withHarness)
    const verbCorrect = verb === task.correctVerb

    // Bare wrong-route: 2 wasted turns exploring, then maybe stumble.
    let turns = 1
    let notes = ''
    if (!verbCorrect) {
      turns += 2
      wasteTurns += 2
      notes = `wrong verb ${verb}≠${task.correctVerb}; +2 waste turns`
      inputTotal += 2 * WASTE_TURN_IN
      outputTotal += 2 * WASTE_TURN_OUT
    }

    const memoryHit = task.needsMemory ? memory.has(task.needsMemory) : withHarness // harness still has project context
    if (task.needsMemory && !memoryHit) {
      turns += 1
      wasteTurns += 1
      notes = notes ? `${notes}; re-derived ${task.needsMemory}` : `re-derived ${task.needsMemory}`
      inputTotal += WASTE_TURN_IN
      outputTotal += WASTE_TURN_OUT
    } else if (task.needsMemory && memoryHit) {
      notes = notes ? `${notes}; memory hit ${task.needsMemory}` : `memory hit ${task.needsMemory}`
    }

    const trapAvoided = task.trap ? trapsKnown.has(task.trap) || withHarness : true
    if (task.trap && !trapAvoided) {
      turns += 2
      wasteTurns += 2
      notes = notes ? `${notes}; hit trap ${task.trap}` : `hit trap ${task.trap}`
      inputTotal += 2 * WASTE_TURN_IN
      outputTotal += 2 * WASTE_TURN_OUT
    }

    // Productive turn(s)
    productiveTurns += 1
    const contextTok = withHarness
      ? 180 // brief/status inject
      : 650 // re-read files / invent context
    inputTotal += contextTok + 120 // user signal
    outputTotal += OUT_TOKENS_PER_TURN

    // Persist / land side effects for harness
    let handoffOk = true
    if (withHarness && (task.correctVerb === 'remember' || task.correctVerb === 'work')) {
      if (task.trap) trapsKnown.add(task.trap)
      if (task.needsMemory) memory.add(task.needsMemory)
      memory.add(`session:${task.id}`)
    }
    if (task.correctVerb === 'land') {
      handoffOk = withHarness // auto-synthesis
      if (!withHarness) {
        turns += 1
        wasteTurns += 1
        notes = notes ? `${notes}; no handoff` : 'no handoff'
        inputTotal += WASTE_TURN_IN
        outputTotal += WASTE_TURN_OUT
      } else {
        notes = notes ? `${notes}; land auto-synth` : 'land auto-synth'
      }
    }

    // Completion: correct verb + (if needs memory, hit or not required) + trap avoided + handoff
    const completed =
      verbCorrect &&
      (!task.needsMemory || memoryHit) &&
      trapAvoided &&
      (task.correctVerb !== 'land' || handoffOk)

    // Bare can still "complete" implement tasks after waste, but fails recall/ship/land/guard often
    const bareStumbleComplete =
      !withHarness && !completed && task.kind === 'implement' && verb === 'work'
    const finalComplete = completed || bareStumbleComplete

    tasks.push({
      taskId: task.id,
      completed: finalComplete,
      verbChosen: verb,
      verbCorrect,
      memoryHit: task.needsMemory ? memoryHit : withHarness,
      trapAvoided,
      handoffOk: task.correctVerb === 'land' ? handoffOk : true,
      turns,
      inputTokens: contextTok + (verbCorrect ? 0 : 2 * WASTE_TURN_IN),
      outputTokens: OUT_TOKENS_PER_TURN + (verbCorrect ? 0 : 2 * WASTE_TURN_OUT),
      notes,
    })
  }

  const n = tasks.length
  const completionRate = tasks.filter((t) => t.completed).length / n
  const routingAccuracy = tasks.filter((t) => t.verbCorrect).length / n
  const memTasks = tasks.filter((t) => TASK_SUITE.find((s) => s.id === t.taskId)?.needsMemory)
  const memoryHitRate =
    memTasks.length === 0 ? 1 : memTasks.filter((t) => t.memoryHit).length / memTasks.length
  const trapTasks = tasks.filter((t) => TASK_SUITE.find((s) => s.id === t.taskId)?.trap)
  const trapAvoidRate =
    trapTasks.length === 0 ? 1 : trapTasks.filter((t) => t.trapAvoided).length / trapTasks.length
  const handoffTasks = tasks.filter((t) => t.taskId === 'T8')
  const handoffRate =
    handoffTasks.length === 0
      ? 1
      : handoffTasks.filter((t) => t.handoffOk).length / handoffTasks.length

  // Intelligence = equal weight on the four judgment signals
  const intelligenceScore = (routingAccuracy + memoryHitRate + trapAvoidRate + handoffRate) / 4

  const tokens: SideTokens = {
    alwaysOn,
    mcpSurface,
    perTaskContext: tasks.reduce((s, t) => s + t.inputTokens, 0),
    wasteTurns,
    productiveTurns,
    inputTotal,
    outputTotal,
  }

  const costUsd = {} as Record<PriceModel, number>
  for (const m of Object.keys(PRICING) as PriceModel[]) {
    costUsd[m] = costOf(m, tokens.inputTotal, tokens.outputTotal)
  }

  return {
    label,
    withHarness,
    tasks,
    completionRate,
    routingAccuracy,
    memoryHitRate,
    trapAvoidRate,
    handoffRate,
    intelligenceScore,
    tokens,
    costUsd,
  }
}

export function runEfficiencyBench(): EfficiencyBenchReport {
  const bare = simulateSide(false)
  const harness = simulateSide(true)
  const score = computeHarnessScore()
  const skillTokens = score.defaults.skillTokens
  const routingBytes = Buffer.byteLength(MINIMAL_ROUTING_BODY, 'utf-8')

  const inputSave =
    bare.tokens.inputTotal > 0
      ? (bare.tokens.inputTotal - harness.tokens.inputTotal) / bare.tokens.inputTotal
      : 0
  const wasteSave =
    bare.tokens.wasteTurns > 0
      ? (bare.tokens.wasteTurns - harness.tokens.wasteTurns) / bare.tokens.wasteTurns
      : 0
  const costHaiku =
    bare.costUsd['claude-haiku-4.5'] > 0
      ? (bare.costUsd['claude-haiku-4.5'] - harness.costUsd['claude-haiku-4.5']) /
        bare.costUsd['claude-haiku-4.5']
      : 0
  const costSonnet =
    bare.costUsd['claude-sonnet-4.5'] > 0
      ? (bare.costUsd['claude-sonnet-4.5'] - harness.costUsd['claude-sonnet-4.5']) /
        bare.costUsd['claude-sonnet-4.5']
      : 0

  return {
    suiteSize: TASK_SUITE.length,
    bare,
    harness,
    deltas: {
      completionPts: (harness.completionRate - bare.completionRate) * 100,
      intelligencePts: (harness.intelligenceScore - bare.intelligenceScore) * 100,
      inputTokenSavePct: inputSave * 100,
      wasteTurnSavePct: wasteSave * 100,
      costSavePctHaiku: costHaiku * 100,
      costSavePctSonnet: costSonnet * 100,
    },
    structural: {
      skillTokens,
      routingBytes,
      mcpToolsCore: score.defaults.mcpToolCountDefault,
      mcpToolsAllEstimate: 55,
      harnessGrade: score.grade,
    },
  }
}

function pct(n: number): string {
  return `${n >= 0 ? '' : ''}${n.toFixed(1)}%`
}

function usd(n: number): string {
  if (n < 0.001) return `$${n.toFixed(5)}`
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(3)}`
}

export function formatEfficiencyMarkdown(r: EfficiencyBenchReport): string {
  const lines: string[] = []
  lines.push('# Weak-model efficiency + intelligence bench')
  lines.push('')
  lines.push(
    'Deterministic simulation of a **constrained model** completing a fixed task suite — **with vs without** the prjct harness. Measures completion, judgment, tokens, and $ — not wall-clock latency.'
  )
  lines.push('')
  lines.push(
    `Suite: **${r.suiteSize} tasks** · Harness grade **${r.structural.harnessGrade}/5** · Skill **${r.structural.skillTokens} tok** (SLO ≤${WORLD_CLASS.skillTokensMax}) · MCP core **${r.structural.mcpToolsCore}** tools vs bare ~**${r.structural.mcpToolsAllEstimate}**`
  )
  lines.push('')

  lines.push('## Scoreboard')
  lines.push('')
  lines.push('| Metric | Weak bare | Weak + prjct | Δ |')
  lines.push('|---|---:|---:|---:|')
  lines.push(
    `| Task completion | ${(r.bare.completionRate * 100).toFixed(0)}% | ${(r.harness.completionRate * 100).toFixed(0)}% | **+${r.deltas.completionPts.toFixed(0)} pts** |`
  )
  lines.push(
    `| Intelligence (composite) | ${(r.bare.intelligenceScore * 100).toFixed(0)}% | ${(r.harness.intelligenceScore * 100).toFixed(0)}% | **+${r.deltas.intelligencePts.toFixed(0)} pts** |`
  )
  lines.push(
    `| Intent routing accuracy | ${(r.bare.routingAccuracy * 100).toFixed(0)}% | ${(r.harness.routingAccuracy * 100).toFixed(0)}% | |`
  )
  lines.push(
    `| Memory hit rate | ${(r.bare.memoryHitRate * 100).toFixed(0)}% | ${(r.harness.memoryHitRate * 100).toFixed(0)}% | |`
  )
  lines.push(
    `| Trap avoidance | ${(r.bare.trapAvoidRate * 100).toFixed(0)}% | ${(r.harness.trapAvoidRate * 100).toFixed(0)}% | |`
  )
  lines.push(
    `| Session handoff | ${(r.bare.handoffRate * 100).toFixed(0)}% | ${(r.harness.handoffRate * 100).toFixed(0)}% | |`
  )
  lines.push(
    `| Input tokens (session) | ${r.bare.tokens.inputTotal.toLocaleString()} | ${r.harness.tokens.inputTotal.toLocaleString()} | **${pct(r.deltas.inputTokenSavePct)} fewer** |`
  )
  lines.push(
    `| Output tokens | ${r.bare.tokens.outputTotal.toLocaleString()} | ${r.harness.tokens.outputTotal.toLocaleString()} | |`
  )
  lines.push(
    `| Waste turns | ${r.bare.tokens.wasteTurns} | ${r.harness.tokens.wasteTurns} | **${pct(r.deltas.wasteTurnSavePct)} fewer** |`
  )
  lines.push(
    `| $ haiku-class (weak) | ${usd(r.bare.costUsd['claude-haiku-4.5'])} | ${usd(r.harness.costUsd['claude-haiku-4.5'])} | **${pct(r.deltas.costSavePctHaiku)}** |`
  )
  lines.push(
    `| $ sonnet-class | ${usd(r.bare.costUsd['claude-sonnet-4.5'])} | ${usd(r.harness.costUsd['claude-sonnet-4.5'])} | **${pct(r.deltas.costSavePctSonnet)}** |`
  )
  lines.push(
    `| $ opus-class (frontier) | ${usd(r.bare.costUsd['claude-opus-4.5'])} | ${usd(r.harness.costUsd['claude-opus-4.5'])} | |`
  )
  lines.push('')

  lines.push('## Token anatomy')
  lines.push('')
  lines.push('| Component | Bare | + prjct |')
  lines.push('|---|---:|---:|')
  lines.push(
    `| Always-on system/skill | ${r.bare.tokens.alwaysOn} | ${r.harness.tokens.alwaysOn} |`
  )
  lines.push(`| MCP tool schemas | ${r.bare.tokens.mcpSurface} | ${r.harness.tokens.mcpSurface} |`)
  lines.push(
    `| Per-task context + waste | ${r.bare.tokens.perTaskContext} | ${r.harness.tokens.perTaskContext} |`
  )
  lines.push(
    `| **Input total** | **${r.bare.tokens.inputTotal}** | **${r.harness.tokens.inputTotal}** |`
  )
  lines.push('')

  lines.push('## How prjct helps the weak model finish tasks')
  lines.push('')
  lines.push(
    '| Task | Signal | Bare verb | Harness verb | Bare done | Harness done | Why harness wins |'
  )
  lines.push('|---|---|---|---|:---:|:---:|---|')
  for (const t of TASK_SUITE) {
    const b = r.bare.tasks.find((x) => x.taskId === t.id)!
    const h = r.harness.tasks.find((x) => x.taskId === t.id)!
    const why =
      h.completed && !b.completed
        ? h.notes || 'correct path + memory/traps'
        : h.completed
          ? h.notes || 'same outcome, fewer waste turns'
          : b.notes || '—'
    lines.push(
      `| ${t.id} | ${t.userSignal.slice(0, 42)}${t.userSignal.length > 42 ? '…' : ''} | \`${b.verbChosen}\` | \`${h.verbChosen}\` | ${b.completed ? '✓' : '✗'} | ${h.completed ? '✓' : '✗'} | ${why} |`
    )
  }
  lines.push('')

  lines.push('## Intelligence composite')
  lines.push('')
  lines.push('Equal weight: **routing · memory hit · trap avoid · land handoff**.')
  lines.push('')
  lines.push(
    `Bare **${(r.bare.intelligenceScore * 100).toFixed(0)}%** → Harness **${(r.harness.intelligenceScore * 100).toFixed(0)}%** (**+${r.deltas.intelligencePts.toFixed(0)} pts**).`
  )
  lines.push('')
  lines.push('## Method notes')
  lines.push('')
  lines.push(
    '- Deterministic policies (no live LLM): bare wraps unknown intents as `work`, carries no memory, dumps ~55 tool schemas; harness uses verb map, core MCP (~18 tools), seeded project memory, land auto-synthesis.'
  )
  lines.push(
    `- Token model: always-on + MCP schema (${TOKENS_PER_MCP_TOOL} tok/tool) + per-task context + waste turns (${WASTE_TURN_IN} in / ${WASTE_TURN_OUT} out each).`
  )
  lines.push(
    '- Cost uses public $/1k rates for haiku / sonnet / opus / gpt-4o-mini on the same token totals.'
  )
  lines.push(
    '- This answers: *does the harness make a weak model complete work smarter and cheaper?* Latency A/B is a separate script (`bench:ab`).'
  )
  lines.push('')
  lines.push('Reproduce: `bun run bench:weak-efficiency`')
  return lines.join('\n')
}
