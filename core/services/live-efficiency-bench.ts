/**
 * Live LLM weak-model efficiency bench.
 *
 * Calls a real model (default: Claude Code `haiku` via logged-in CLI) on each
 * task twice — bare system prompt vs prjct harness prompt — and scores
 * completion, intelligence, tokens, and $.
 */

import { assertClaudeLiveReady, callClaudeLive, extractVerb } from '../eval/live-claude'
import { buildPrjctSkill, emptySkillContext } from './skill-generator/prjct-skill-body'
import { TASK_SUITE, type TaskScenario } from './weak-efficiency-bench'

export interface LiveTaskOutcome {
  taskId: string
  side: 'bare' | 'harness'
  userSignal: string
  correctVerb: string
  verbChosen: string | null
  verbCorrect: boolean
  completed: boolean
  text: string
  costUsd: number
  turns: number
  durationMs: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  billableTokens: number
  error?: string
}

export interface LiveSideSummary {
  label: string
  completionRate: number
  routingAccuracy: number
  totalCostUsd: number
  totalBillableTokens: number
  totalOutputTokens: number
  totalTurns: number
  avgDurationMs: number
  tasks: LiveTaskOutcome[]
}

export interface LiveEfficiencyReport {
  mode: 'live'
  model: string
  authEmail?: string
  suiteSize: number
  bare: LiveSideSummary
  harness: LiveSideSummary
  deltas: {
    completionPts: number
    routingPts: number
    billableTokenSavePct: number
    costSavePct: number
    turnSavePct: number
  }
  outcomes: LiveTaskOutcome[]
}

const VERB_SCHEMA = {
  type: 'object',
  properties: {
    verb: {
      type: 'string',
      enum: ['work', 'search', 'remember', 'ship', 'next', 'land', 'guard', 'sync'],
    },
    reason: { type: 'string' },
  },
  required: ['verb', 'reason'],
  additionalProperties: false,
} as const

const BARE_SYSTEM = `You are a coding agent WITHOUT a project memory system and WITHOUT the prjct harness.
Choose exactly one action verb for the user's request.
Allowed verbs: work, search, remember, ship, next, land, guard, sync.
If unsure, choose work.
Never call tools. Never ask questions. Structured output only.`

function harnessSystem(skill: string, memoryBlock: string): string {
  return `You are a coding agent WITH the prjct harness installed.
Pick the correct prjct verb — never wrap bin verbs as freeform work.

## Verb map (mandatory)
- search / find / recall / look up knowledge → search
- remember / save a decision|learning|gotcha / pin a fact → remember
- fix / build / implement / bug → work
- what next / ready / what should I work on → next
- ship / open a PR → ship
- land / close session / done for today / hand off → land
- traps before edit / guard file / any traps before I edit → guard
- sync project → sync

## prjct skill (always-on)
${skill}

## Project memory available this session
${memoryBlock}

Never call tools. Never ask questions. Structured output only.`
}

const MEMORY_BANK = `- [decision] auth-session: session cookies must be httpOnly + SameSite=Lax
- [gotcha] rate-limit-double-fire: statusline banner can double-fire without source tags
- [gotcha] migration-non-idempotent: SQLite migrations must use IF NOT EXISTS
- [learning] transcript-auto: Stop hook auto-captures Decision:/Gotcha: labels
- [fact] task-service: resolve active task per worktree, never clobber sibling agents
- [gotcha] npm12-node20-engines: Release must pin Node 22 + npm@11 for publish`

function promptFor(task: TaskScenario): string {
  return `User said: ${task.userSignal}

Success looks like: ${task.success}
${task.needsMemory ? `Relevant memory topic if available: ${task.needsMemory}` : ''}
${task.trap ? `Known trap if recalled: ${task.trap}` : ''}

Choose the single best first verb.`
}

function summarize(label: string, tasks: LiveTaskOutcome[]): LiveSideSummary {
  const n = tasks.length || 1
  const completionRate = tasks.filter((t) => t.completed).length / n
  const routingAccuracy = tasks.filter((t) => t.verbCorrect).length / n
  return {
    label,
    completionRate,
    routingAccuracy,
    totalCostUsd: tasks.reduce((s, t) => s + t.costUsd, 0),
    totalBillableTokens: tasks.reduce((s, t) => s + t.billableTokens, 0),
    totalOutputTokens: tasks.reduce((s, t) => s + t.outputTokens, 0),
    totalTurns: tasks.reduce((s, t) => s + t.turns, 0),
    avgDurationMs: tasks.reduce((s, t) => s + t.durationMs, 0) / n,
    tasks,
  }
}

async function runSide(
  side: 'bare' | 'harness',
  systemPrompt: string,
  model: string,
  tasks: TaskScenario[]
): Promise<LiveTaskOutcome[]> {
  const out: LiveTaskOutcome[] = []
  for (const task of tasks) {
    process.stderr.write(`  [${side}] ${task.id} ${task.correctVerb}… `)
    const res = await callClaudeLive({
      prompt: promptFor(task),
      systemPrompt,
      model,
      timeoutMs: 180_000,
      jsonSchema: VERB_SCHEMA as unknown as Record<string, unknown>,
    })
    const verb = extractVerb(res.text)
    const verbCorrect = verb === task.correctVerb
    // Live completion for this suite = correct first verb (routing intelligence).
    // Multi-step agent loops are out of scope for the one-shot protocol.
    const completed = verbCorrect && res.ok
    process.stderr.write(
      `${verb ?? '—'} ${verbCorrect ? '✓' : '✗'} $${res.costUsd.toFixed(4)} ${res.usage.billableTokens} tok\n`
    )
    out.push({
      taskId: task.id,
      side,
      userSignal: task.userSignal,
      correctVerb: task.correctVerb,
      verbChosen: verb,
      verbCorrect,
      completed,
      text: res.text.slice(0, 500),
      costUsd: res.costUsd,
      turns: res.turns,
      durationMs: res.durationMs,
      inputTokens: res.usage.inputTokens,
      outputTokens: res.usage.outputTokens,
      cacheCreationTokens: res.usage.cacheCreationTokens,
      cacheReadTokens: res.usage.cacheReadTokens,
      billableTokens: res.usage.billableTokens,
      error: res.error,
    })
  }
  return out
}

export async function runLiveEfficiencyBench(
  opts: {
    model?: string
    /** Limit suite size (default all). */
    limit?: number
  } = {}
): Promise<LiveEfficiencyReport> {
  const auth = await assertClaudeLiveReady()
  const model = opts.model ?? process.env.PRJCT_LIVE_MODEL ?? 'haiku'
  const suite = opts.limit ? TASK_SUITE.slice(0, opts.limit) : TASK_SUITE
  const skill = buildPrjctSkill(emptySkillContext())

  process.stderr.write(
    `Live efficiency bench · model=${model} · tasks=${suite.length} · auth=${auth.email ?? '?'}\n`
  )

  process.stderr.write('## Bare (no harness)\n')
  const bareTasks = await runSide('bare', BARE_SYSTEM, model, suite)
  process.stderr.write('## Harness (prjct)\n')
  const harnessTasks = await runSide('harness', harnessSystem(skill, MEMORY_BANK), model, suite)

  const bare = summarize('weak bare (live)', bareTasks)
  const harness = summarize('weak + prjct (live)', harnessTasks)

  const billableSave =
    bare.totalBillableTokens > 0
      ? (bare.totalBillableTokens - harness.totalBillableTokens) / bare.totalBillableTokens
      : 0
  const costSave =
    bare.totalCostUsd > 0 ? (bare.totalCostUsd - harness.totalCostUsd) / bare.totalCostUsd : 0
  const turnSave =
    bare.totalTurns > 0 ? (bare.totalTurns - harness.totalTurns) / bare.totalTurns : 0

  return {
    mode: 'live',
    model,
    authEmail: auth.email,
    suiteSize: suite.length,
    bare,
    harness,
    deltas: {
      completionPts: (harness.completionRate - bare.completionRate) * 100,
      routingPts: (harness.routingAccuracy - bare.routingAccuracy) * 100,
      billableTokenSavePct: billableSave * 100,
      costSavePct: costSave * 100,
      turnSavePct: turnSave * 100,
    },
    outcomes: [...bareTasks, ...harnessTasks],
  }
}

function pct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

export function formatLiveEfficiencyMarkdown(r: LiveEfficiencyReport): string {
  const lines: string[] = []
  lines.push('# Live weak-model efficiency + intelligence bench')
  lines.push('')
  lines.push(
    `**Mode: LIVE LLM** · model \`${r.model}\` · auth \`${r.authEmail ?? 'unknown'}\` · **${r.suiteSize} tasks** × 2 sides`
  )
  lines.push('')
  lines.push(
    'Each task is a real model call (Claude Code print mode). Bare vs harness differ only by system prompt + injected memory/skill. Tools disabled; score = correct first verb + token/$.'
  )
  lines.push('')
  lines.push('## Scoreboard')
  lines.push('')
  lines.push('| Metric | Bare live | + prjct live | Δ |')
  lines.push('|---|---:|---:|---:|')
  lines.push(
    `| Task completion (correct verb) | ${(r.bare.completionRate * 100).toFixed(0)}% | ${(r.harness.completionRate * 100).toFixed(0)}% | **${pct(r.deltas.completionPts)} pts** |`
  )
  lines.push(
    `| Routing accuracy | ${(r.bare.routingAccuracy * 100).toFixed(0)}% | ${(r.harness.routingAccuracy * 100).toFixed(0)}% | **${pct(r.deltas.routingPts)} pts** |`
  )
  lines.push(
    `| Billable tokens (in+cache_create+out) | ${r.bare.totalBillableTokens.toLocaleString()} | ${r.harness.totalBillableTokens.toLocaleString()} | **${r.deltas.billableTokenSavePct.toFixed(1)}% fewer on harness** |`
  )
  lines.push(
    `| Output tokens | ${r.bare.totalOutputTokens.toLocaleString()} | ${r.harness.totalOutputTokens.toLocaleString()} | |`
  )
  lines.push(
    `| Total turns | ${r.bare.totalTurns} | ${r.harness.totalTurns} | **${r.deltas.turnSavePct.toFixed(1)}% fewer on harness** |`
  )
  lines.push(
    `| API cost (USD) | $${r.bare.totalCostUsd.toFixed(4)} | $${r.harness.totalCostUsd.toFixed(4)} | **${r.deltas.costSavePct.toFixed(1)}% on harness** |`
  )
  lines.push(
    `| Avg latency | ${(r.bare.avgDurationMs / 1000).toFixed(1)}s | ${(r.harness.avgDurationMs / 1000).toFixed(1)}s | |`
  )
  lines.push('')
  lines.push('## Per-task (live)')
  lines.push('')
  lines.push(
    '| Task | Correct | Bare verb | Harness verb | Bare $ | Harness $ | Bare billable | Harness billable |'
  )
  lines.push('|---|---|---|---|---:|---:|---:|---:|')
  for (const t of TASK_SUITE.slice(0, r.suiteSize)) {
    const b = r.bare.tasks.find((x) => x.taskId === t.id)
    const h = r.harness.tasks.find((x) => x.taskId === t.id)
    if (!b || !h) continue
    lines.push(
      `| ${t.id} | \`${t.correctVerb}\` | \`${b.verbChosen ?? '—'}\`${b.verbCorrect ? '' : ' ✗'} | \`${h.verbChosen ?? '—'}\`${h.verbCorrect ? '' : ' ✗'} | $${b.costUsd.toFixed(4)} | $${h.costUsd.toFixed(4)} | ${b.billableTokens} | ${h.billableTokens} |`
    )
  }
  lines.push('')
  lines.push('## Method')
  lines.push('')
  lines.push(
    '- Live via `claude -p --output-format json` (user Max/OAuth). Isolated cwd, empty MCP, tools disallowed.'
  )
  lines.push(
    '- **Billable tokens** = input + cache_creation + output (cache_read excluded — heavily discounted).'
  )
  lines.push(
    '- Intelligence proxy for one-shot protocol = routing accuracy / completion (correct first verb under harness context).'
  )
  lines.push(
    '- Reproduce: `bun run bench:weak-efficiency` (live default) · `PRJCT_LIVE_MODEL=haiku`'
  )
  lines.push('- Sim-only (no LLM): `bun run bench:weak-efficiency -- --sim`')
  return lines.join('\n')
}
