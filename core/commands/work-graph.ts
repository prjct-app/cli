/**
 * Work-graph verbs — the agent-facing surface of the dependency graph.
 *
 *   prjct ready [--md]              the unblocked frontier, ranked
 *   prjct next [--md]               top unclaimed item + orchestration directive
 *   prjct claim <id> [--as name]    race-free claim for multi-agent fan-out
 *   prjct depend <id> --on <id> [--type blocks|parent|related|discovered-from]
 *   prjct phases [--md]             topological parallelization plan
 *   prjct expand <id> ["sub" ...]   read the decomposition record / persist subtasks
 */

import { buildTaskHarness } from '../services/task-harness'
import { orchestrationFor } from '../services/task-orchestration'
import { type DepType, workGraph } from '../services/work-graph'
import { queueStorage } from '../storage/queue-storage'
import type { CommandResult } from '../types/commands'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'
import { requireProject } from './guards'

interface GraphOptions {
  md?: boolean
  on?: string
  type?: string
  as?: string
}

const DEP_TYPES: DepType[] = ['blocks', 'parent', 'related', 'discovered-from']

export class WorkGraphCommands extends PrjctCommandsBase {
  async ready(
    _input: string | null = null,
    projectPath: string = process.cwd(),
    options: GraphOptions = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const items = workGraph.ready(proj.value)
    if (items.length === 0) {
      const msg =
        'Nothing ready — the backlog is empty or fully blocked. `prjct phases --md` shows why.'
      if (options.md) console.log(`> ${msg}`)
      else out.info(msg)
      return { success: true, ready: 0 }
    }
    if (options.md) {
      const lines = [
        `# Ready frontier — ${items.length} unblocked item(s)`,
        '',
        '| Id | Item | Priority | Unblocks | Claimed |',
        '|---|---|---|---:|---|',
      ]
      for (const i of items) {
        lines.push(
          `| \`${i.id.slice(0, 8)}\` | ${i.description.slice(0, 90)} | ${i.priority ?? '-'} | ${i.unblocks} | ${i.claimedBy ?? '—'} |`
        )
      }
      lines.push('', 'Claim before working: `prjct claim <id>`. Full id via `prjct sync --md`.')
      console.log(lines.join('\n'))
    } else {
      out.info(`${items.length} ready item(s):`)
      for (const i of items) out.info(`  • [${i.id.slice(0, 8)}] ${i.description.slice(0, 80)}`)
    }
    return { success: true, ready: items.length, items }
  }

  async next(
    _input: string | null = null,
    projectPath: string = process.cwd(),
    options: GraphOptions = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const item = workGraph.next(proj.value)
    if (!item) {
      const msg = 'No unclaimed ready work. `prjct ready --md` for the frontier.'
      if (options.md) console.log(`> ${msg}`)
      else out.info(msg)
      return { success: true, next: null }
    }
    // prjct's edge over beads/Task Master: the next item ships WITH its
    // orchestration directive — model tier, effort, ceremony, fan-out.
    const harness = buildTaskHarness(item.description)
    const plan = orchestrationFor(harness)
    if (options.md) {
      const lines = [
        `# Next: ${item.description}`,
        '',
        `- Id: \`${item.id}\` · priority: ${item.priority ?? '-'} · unblocks ${item.unblocks} item(s)`,
        `- Orchestration: ${plan.model}/${plan.effort} · spec: ${plan.spec} · tests: ${plan.tests} · fan-out: ${plan.fanout} · ~${plan.expectedPoints} pt`,
        '',
        `Claim it: \`prjct claim ${item.id}\` — then \`prjct work "${item.description.slice(0, 60)}"\``,
      ]
      console.log(lines.join('\n'))
    } else {
      out.info(`next: [${item.id.slice(0, 8)}] ${item.description}`)
    }
    return { success: true, next: item, orchestration: plan }
  }

  async claim(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: GraphOptions = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const id = await this.resolveId(proj.value, (input ?? '').trim())
    if (!id) return this.fail('Usage: prjct claim <task-id>', options)
    const claimant = options.as ?? process.env.PRJCT_AGENT ?? 'claude'
    const won = workGraph.claim(proj.value, id, claimant)
    const msg = won
      ? `claimed ${id.slice(0, 8)} as ${claimant}`
      : `claim lost — ${id.slice(0, 8)} is already taken`
    if (options.md) console.log(`${won ? '✓' : '✗'} ${msg}`)
    else if (won) out.done(msg)
    else out.fail(msg)
    return { success: won, id, claimant }
  }

  async depend(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: GraphOptions = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const fromRaw = (input ?? '').trim()
    if (!fromRaw || !options.on) {
      return this.fail(
        'Usage: prjct depend <id> --on <id> [--type blocks|parent|related|discovered-from]',
        options
      )
    }
    const depType = (options.type ?? 'blocks') as DepType
    if (!DEP_TYPES.includes(depType)) {
      return this.fail(`Unknown dep type '${options.type}'. Use: ${DEP_TYPES.join(' | ')}`, options)
    }
    const fromId = await this.resolveId(proj.value, fromRaw)
    const toId = await this.resolveId(proj.value, options.on.trim())
    if (!fromId || !toId) return this.fail('Could not resolve one of the ids', options)
    try {
      workGraph.addDependency(proj.value, fromId, toId, depType)
    } catch (error) {
      return this.fail(error instanceof Error ? error.message : 'dependency rejected', options)
    }
    const msg = `${fromId.slice(0, 8)} —${depType}→ ${toId.slice(0, 8)}`
    if (options.md) console.log(`✓ ${msg}`)
    else out.done(msg)
    return { success: true, fromId, toId, depType }
  }

  async phases(
    _input: string | null = null,
    projectPath: string = process.cwd(),
    options: GraphOptions = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const plan = workGraph.phases(proj.value)
    if (plan.length === 0) {
      const msg = 'No open work in the graph.'
      if (options.md) console.log(`> ${msg}`)
      else out.info(msg)
      return { success: true, phases: 0 }
    }
    if (options.md) {
      const lines = [
        '# Execution phases (topological)',
        '',
        'Items in the SAME phase have no dependency path between them — safe to fan out in parallel.',
        '',
      ]
      for (const p of plan) {
        lines.push(`## Phase ${p.phase} — ${p.items.length} item(s), parallelizable`)
        for (const i of p.items) {
          const harness = buildTaskHarness(i.description)
          const o = orchestrationFor(harness)
          lines.push(
            `- \`${i.id.slice(0, 8)}\` ${i.description.slice(0, 80)} _(${o.model}/${o.effort}, ~${o.expectedPoints} pt)_`
          )
        }
        lines.push('')
      }
      console.log(lines.join('\n'))
    } else {
      for (const p of plan) out.info(`phase ${p.phase}: ${p.items.length} item(s)`)
    }
    return { success: true, phases: plan.length, plan }
  }

  async expand(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: GraphOptions = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const parts = (input ?? '')
      .trim()
      .split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((p) => p.replace(/^"|"$/g, ''))
      .filter(Boolean)
    const idRaw = parts[0]
    if (!idRaw) return this.fail('Usage: prjct expand <id> ["subtask 1" "subtask 2" ...]', options)
    const id = await this.resolveId(proj.value, idRaw)
    if (!id) return this.fail(`Unknown item '${idRaw}'`, options)
    const subDescriptions = parts.slice(1)

    if (subDescriptions.length === 0) {
      // Read side: serve the decomposition record (or compute one now).
      const parent = (await queueStorage.getTasks(proj.value)).find((t) => t.id === id)
      const description = parent?.description ?? id
      let rec = workGraph.getComplexity(proj.value, id)
      if (!rec) {
        const harness = buildTaskHarness(description)
        const plan = orchestrationFor(harness)
        rec = {
          score: plan.expectedPoints,
          recommendedSubtasks: plan.expectedPoints >= 5 ? Math.min(plan.expectedPoints, 6) : 0,
          expansionPrompt: `Decompose "${description}" into ${Math.min(plan.expectedPoints, 6)} independent, testable subtasks; make dependencies explicit; each subtask ≤ 2 points.`,
          reasoning: `Triage level ${harness.level}; ~${plan.expectedPoints} points.`,
        }
        workGraph.recordComplexity(proj.value, id, {
          score: rec.score,
          recommendedSubtasks: rec.recommendedSubtasks,
          expansionPrompt: rec.expansionPrompt ?? undefined,
          reasoning: rec.reasoning ?? undefined,
        })
      }
      if (options.md) {
        const lines = [
          `# Expand \`${id.slice(0, 8)}\` — ${description.slice(0, 90)}`,
          '',
          `- Complexity: ${rec.score} pt · recommended subtasks: ${rec.recommendedSubtasks}`,
          ...(rec.reasoning ? [`- Reasoning: ${rec.reasoning}`] : []),
          '',
          rec.recommendedSubtasks > 0
            ? `${rec.expansionPrompt}\n\nPersist your decomposition: \`prjct expand ${id.slice(0, 8)} "subtask 1" "subtask 2" ...\``
            : 'Small enough — no decomposition needed. Work it directly.',
        ]
        console.log(lines.join('\n'))
      } else {
        out.info(`complexity ${rec.score} pt, recommended subtasks: ${rec.recommendedSubtasks}`)
      }
      return { success: true, id, complexity: rec }
    }

    // Write side: persist the agent's decomposition as backlog items with
    // parent edges (the parent is blocked until all children complete).
    const created: string[] = []
    for (const desc of subDescriptions) {
      const task = await queueStorage.addTask(proj.value, {
        description: desc,
        section: 'active',
        type: 'feature',
        priority: 'medium',
      })
      workGraph.addDependency(proj.value, id, task.id, 'parent')
      created.push(task.id)
    }
    const msg = `expanded into ${created.length} subtask(s); parent is blocked until they complete`
    if (options.md) console.log(`✓ ${msg}`)
    else out.done(msg)
    return { success: true, id, created }
  }

  /** Accept full UUIDs or unambiguous short prefixes (beads-style). */
  private async resolveId(projectId: string, raw: string): Promise<string | null> {
    if (!raw) return null
    const all = await queueStorage.getTasks(projectId)
    const exact = all.find((t) => t.id === raw)
    if (exact) return exact.id
    const matches = all.filter((t) => t.id.startsWith(raw))
    return matches.length === 1 ? matches[0].id : null
  }

  private fail(msg: string, options: GraphOptions): CommandResult {
    if (options.md) console.log(`> ${msg}`)
    else out.fail(msg)
    return { success: false, error: msg }
  }
}
