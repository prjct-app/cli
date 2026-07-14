/**
 * Tier-2 ceremonies (harness research: BMAD + Task Master + beads):
 *
 *   prjct log "<note>" [--task id]   append-only implementation journal —
 *                                    "what did the last agent try", the
 *                                    cheapest session-to-session continuity
 *   prjct brief [id] [--md]          COMPILED context artifact for a task:
 *                                    orchestration + journal + guards +
 *                                    related memory + sibling ships. BMAD
 *                                    compiles context; prjct compiles it
 *                                    from a database instead of files.
 *   prjct replan "<what changed>"    cascading drift repair: re-plan
 *                                    directive over downstream open items +
 *                                    automatic decision memory of the pivot
 *   prjct prime [--md]               session-open bundle: cycle + frontier +
 *                                    traps + budget in one pull
 *   prjct land [--md]                session-close checklist ("land the
 *                                    plane"): what is uncaptured, unclaimed,
 *                                    unfinished — BEFORE the context dies
 */

import { deriveTitle } from '../memory/format'
import { projectMemory } from '../memory/project-memory'
import { extractDeveloperRules } from '../services/developer-profile'
import { buildTaskHarness } from '../services/task-harness'
import { orchestrationFor } from '../services/task-orchestration'
import { collectActiveTasks } from '../services/task-overview'
import { workGraph } from '../services/work-graph'
import { prjctDb } from '../storage/database'
import { queueStorage } from '../storage/queue-storage'
import type { CommandResult } from '../types/commands'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'
import { requireProject } from './guards'

/** Cold-start apply-loop: enough rules for a fresh window to act as the dev. */
const PRIME_DEV_RULES = 4
const PRIME_TRAPS = 3

interface CeremonyOptions {
  md?: boolean
  task?: string
  force?: boolean
  dryRun?: boolean
  minHours?: number
  minSessions?: number
}

export class CeremonyCommands extends PrjctCommandsBase {
  /** Append a journal entry to the active (or named) work cycle. */
  async log(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: CeremonyOptions = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const content = (input ?? '').trim()
    if (!content)
      return this.fail('Usage: prjct log "<what you tried / found>" [--task id]', options)
    let taskId = options.task
    if (!taskId) {
      const overview = await collectActiveTasks(proj.value, projectPath).catch(() => null)
      taskId = overview?.current?.id
    }
    if (!taskId) return this.fail('No active work cycle — pass --task <id>', options)
    prjctDb.run(
      proj.value,
      'INSERT INTO task_log (task_id, session_id, content, created_at) VALUES (?, ?, ?, ?)',
      taskId,
      process.env.CLAUDE_SESSION_ID ?? null,
      content,
      new Date().toISOString()
    )
    const msg = `logged to ${taskId.slice(0, 8)}: ${content.slice(0, 70)}`
    if (options.md) console.log(`✓ ${msg}`)
    else out.done(msg)
    return { success: true, taskId }
  }

  /** Compile (and persist) the context brief for a task. */
  async brief(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: CeremonyOptions = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    let taskId = (input ?? '').trim() || undefined
    let description: string | undefined
    if (!taskId) {
      const overview = await collectActiveTasks(proj.value, projectPath).catch(() => null)
      taskId = overview?.current?.id
      description = overview?.current?.description
    }
    if (!taskId) return this.fail('No active work cycle — pass a task id', options)
    if (!description) {
      description =
        (await queueStorage.getTasks(proj.value)).find((t) => t.id === taskId)?.description ??
        prjctDb.get<{ description: string }>(
          proj.value,
          'SELECT description FROM tasks WHERE id = ?',
          taskId
        )?.description ??
        taskId
    }

    const sections: string[] = [`# Brief — ${description}`, '']

    // 1. Orchestration directive (how to run THIS task).
    const harness = buildTaskHarness(description)
    const plan = orchestrationFor(harness)
    sections.push(
      `**Orchestration:** ${plan.model}/${plan.effort} · spec: ${plan.spec} · tests: ${plan.tests} · fan-out: ${plan.fanout} · ~${plan.expectedPoints} pt`,
      ''
    )

    // 2. Journal — what previous sessions tried (last 8 entries).
    const journal = prjctDb.query<{ content: string; created_at: string }>(
      proj.value,
      'SELECT content, created_at FROM task_log WHERE task_id = ? ORDER BY id DESC LIMIT 8',
      taskId
    )
    if (journal.length > 0) {
      sections.push('## Journal (previous attempts)', '')
      for (const j of journal.reverse()) {
        sections.push(`- ${j.created_at.slice(5, 16)} — ${j.content}`)
      }
      sections.push('')
    }

    // 3. Related memory — decisions/gotchas ranked against the description.
    try {
      const keywords = description
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 6)
      const hits = projectMemory.searchFts(proj.value, keywords, 5)
      if (hits.length > 0) {
        sections.push('## Related memory', '')
        for (const h of hits) sections.push(`- [${h.id} · ${h.type}] ${h.content.slice(0, 140)}`)
        sections.push('')
      }
    } catch {
      /* FTS unavailable → brief still useful */
    }

    // 4. Sibling context (BMAD's epic-rolling-context): recently shipped
    // work — conventions the codebase just adopted.
    const siblings = prjctDb.query<{ description: string }>(
      proj.value,
      `SELECT description FROM tasks WHERE status IN ('completed','shipped') AND id != ?
       ORDER BY COALESCE(completed_at, shipped_at) DESC LIMIT 3`,
      taskId
    )
    if (siblings.length > 0) {
      sections.push('## Recently landed (follow their conventions)', '')
      for (const s of siblings) sections.push(`- ${s.description.slice(0, 110)}`)
      sections.push('')
    }

    // 5. Graph position.
    const deps = workGraph.dependenciesOf(proj.value, taskId)
    if (deps.length > 0) {
      sections.push('## Graph position', '')
      for (const d of deps) {
        sections.push(`- \`${d.fromId.slice(0, 8)}\` —${d.depType}→ \`${d.toId.slice(0, 8)}\``)
      }
      sections.push('')
    }

    sections.push('_Compiled brief — regenerate with `prjct brief` after major drift._')
    const content = sections.join('\n')

    prjctDb.run(
      proj.value,
      `INSERT INTO task_briefs (task_id, content, created_at) VALUES (?, ?, ?)
       ON CONFLICT(task_id) DO UPDATE SET content = excluded.content, created_at = excluded.created_at`,
      taskId,
      content,
      new Date().toISOString()
    )

    console.log(content)
    return { success: true, taskId, bytes: content.length }
  }

  /** Cascading drift repair + automatic decision capture. */
  async replan(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: CeremonyOptions = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const change = (input ?? '').trim()
    if (!change) return this.fail('Usage: prjct replan "<what actually changed>"', options)

    // The pivot is a decision the project must remember — captured BEFORE
    // the re-planning, so it survives even if the session dies mid-replan.
    await projectMemory.remember(projectPath, {
      type: 'decision',
      content: `Replan: ${change}`,
      tags: { topic: 'replan' },
      provenance: 'declared',
    })

    const ready = workGraph.ready(proj.value, { limit: 15 })
    const lines = [
      '# Replan directive',
      '',
      `**What changed:** ${change}`,
      '',
      'Re-evaluate each open item below against the change. For each one: still valid → leave;',
      'obsolete → complete or remove it; needs rewording → update via `prjct sync` flow;',
      'new work implied → `prjct capture "<item>" --fromCurrent`.',
      '',
    ]
    for (const i of ready) lines.push(`- \`${i.id.slice(0, 8)}\` ${i.description.slice(0, 100)}`)
    lines.push('', '_The pivot was already captured as a decision memory._')
    console.log(lines.join('\n'))
    return { success: true, items: ready.length }
  }

  /**
   * Session-open bundle: managed-session resume + developer grounding.
   *
   * Brutal bar vs fresh-context harnesses (e.g. GSD): a new window with
   * `prjct prime` must already *be* this developer on this project — last land
   * stamp, session-close hand-off, cycle + frontier + standing rules + traps.
   * Deeper recall stays on demand so tokens stay lean.
   */
  async prime(
    _input: string | null = null,
    projectPath: string = process.cwd(),
    options: CeremonyOptions = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const overview = await collectActiveTasks(proj.value, projectPath).catch(() => null)

    // Managed session resume card (land → prime continuity).
    let journal: string[] = []
    if (overview?.current) {
      journal = prjctDb
        .query<{ content: string }>(
          proj.value,
          'SELECT content FROM task_log WHERE task_id = ? ORDER BY id DESC LIMIT 3',
          overview.current.id
        )
        .map((j) => j.content)
        .reverse()
    }
    const { loadSessionContinuity, loadLastSessionCloseContent, formatSessionResumeCard } =
      await import('../services/session-continuity')
    const stamp = loadSessionContinuity(proj.value)
    const sessionClose = loadLastSessionCloseContent(proj.value)
    let pendingHandoffCue: string | null = null
    try {
      const { formatPendingHandoffCue } = await import('../services/agent-switch')
      pendingHandoffCue = formatPendingHandoffCue(proj.value)
    } catch {
      pendingHandoffCue = null
    }
    const lines: string[] = [
      formatSessionResumeCard({
        stamp,
        liveCycleDescription: overview?.current?.description ?? null,
        liveCycleId: overview?.current?.id ?? null,
        journal,
        sessionCloseContent: sessionClose,
        pendingHandoffCue,
      }),
      '',
    ]

    const ready = workGraph.ready(proj.value, { limit: 5 })
    if (ready.length > 0) {
      lines.push('**Ready frontier:**')
      for (const i of ready) lines.push(`- \`${i.id.slice(0, 8)}\` ${i.description.slice(0, 90)}`)
      lines.push('')
    }

    // Apply-loop: push developer model + traps into every fresh window.
    try {
      const pool = projectMemory.recall(proj.value, {
        types: ['feedback', 'improvement-signal'],
        limit: 40,
        dedupeByKey: false,
      })
      const rules = extractDeveloperRules(pool, PRIME_DEV_RULES)
      if (rules.length > 0) {
        lines.push('**Act as this developer:**')
        for (const r of rules) {
          const tag = r.kind === 'preference' ? 'said' : 'showed'
          lines.push(`- ${r.rule.slice(0, 140)} _(${tag})_`)
        }
        lines.push('')
      }
    } catch {
      // Best-effort — prime never fails for missing memory.
    }
    try {
      const traps = projectMemory.recall(proj.value, {
        types: ['gotcha', 'anti-pattern'],
        limit: PRIME_TRAPS,
      })
      if (traps.length > 0) {
        lines.push('**Top traps (do not re-pay):**')
        for (const t of traps) {
          lines.push(`- ${deriveTitle(t).slice(0, 100)} \`${t.id}\``)
        }
        lines.push('')
      }
    } catch {
      // ignore
    }

    // Token economics (daily product score) + weak-model mode banner.
    try {
      const { default: configManager } = await import('../infrastructure/config-manager')
      const cfg = await configManager.readConfig(projectPath)
      const { buildTokenEconomics } = await import('../services/token-economics')
      const cycle = overview?.current
      const econ = buildTokenEconomics(proj.value, {
        cycleTokensIn:
          cycle && 'tokensIn' in cycle ? (cycle as { tokensIn?: number }).tokensIn : undefined,
        cycleTokensOut:
          cycle && 'tokensOut' in cycle ? (cycle as { tokensOut?: number }).tokensOut : undefined,
        maxTokensPerCycle: cfg?.maxTokensPerCycle ?? null,
      })
      lines.push(`**${econ.line}**`)
      const { effectiveWeakModelMode, weakModelOneLiner } = await import(
        '../services/weak-model-mode'
      )
      if (effectiveWeakModelMode(cfg) === 'on') {
        lines.push(`**${weakModelOneLiner()}**`)
      }
    } catch {
      /* best-effort */
    }

    console.log(`${lines.join('\n').trimEnd()}\n`)
    const { isContinuityFresh } = await import('../services/session-continuity')
    return {
      success: true,
      continuity: stamp
        ? {
            landedAt: stamp.landedAt,
            cycleId: stamp.cycleId,
            fresh: isContinuityFresh(stamp),
          }
        : null,
    }
  }

  /** Session-close checklist — land the plane before the context dies. */
  async land(
    _input: string | null = null,
    projectPath: string = process.cwd(),
    options: CeremonyOptions = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const lines = ['# Land the plane', '']
    const todo: string[] = []
    const overview = await collectActiveTasks(proj.value, projectPath).catch(() => null)

    // Auto-synthesis: write the hand-off NOW so the agent never has to
    // remember to `prjct remember context "Session close: …"`.
    const { synthesizeLandHandoff } = await import('../services/land-synthesis')
    const handoff = await synthesizeLandHandoff({
      projectId: proj.value,
      projectPath,
      cycleDescription: overview?.current?.description ?? null,
      cycleId: overview?.current?.id ?? null,
    }).catch(() => null)

    // Closed-loop Judgment Receipt (continuity proof — not bulk memory).
    const { synthesizeJudgmentReceipt } = await import('../services/judgment-receipt')
    const receipt = await synthesizeJudgmentReceipt({
      projectId: proj.value,
      projectPath,
      cycleDescription: overview?.current?.description ?? null,
      cycleId: overview?.current?.id ?? null,
    }).catch(() => null)

    // Managed session stamp — next `prjct prime` restores this SoT.
    let continuityStamp: import('../services/session-continuity').SessionContinuityStamp | null =
      null
    try {
      const { default: configManager } = await import('../infrastructure/config-manager')
      const cfg = await configManager.readConfig(projectPath).catch(() => null)
      const { stateStorage } = await import('../storage/state-storage')
      const task = overview?.current
        ? await stateStorage.getCurrentTask(proj.value).catch(() => null)
        : null
      const { stampSessionContinuity, formatLandContinuityFooter } = await import(
        '../services/session-continuity'
      )
      continuityStamp = stampSessionContinuity({
        projectId: proj.value,
        projectPath,
        config: cfg,
        cycleId: overview?.current?.id ?? null,
        cycleDescription: overview?.current?.description ?? null,
        turns: task?.turnCount ?? null,
        tokensIn: task?.tokensIn ?? null,
        tokensOut: task?.tokensOut ?? null,
        handoffWrote: handoff?.wrote ?? false,
        receiptWrote: receipt?.wrote ?? false,
        handoffContent: handoff?.content ?? null,
      })
      void formatLandContinuityFooter
    } catch {
      continuityStamp = null
    }

    if (overview?.current) {
      todo.push(
        `Active cycle still open: "${overview.current.description.slice(0, 70)}" — finish it (\`prjct status done\`) or journal the state (\`prjct log "..."\`).`
      )
    }
    const claimed = prjctDb.query<{ id: string; description: string }>(
      proj.value,
      'SELECT id, description FROM queue_tasks WHERE completed = 0 AND claimed_by IS NOT NULL LIMIT 5'
    )
    for (const c of claimed) {
      todo.push(
        `Claimed but open: \`${c.id.slice(0, 8)}\` ${c.description.slice(0, 60)} — release or finish.`
      )
    }
    const pendingSync = prjctDb.get<{ c: number }>(
      proj.value,
      'SELECT COUNT(*) AS c FROM sync_pending'
    )
    if ((pendingSync?.c ?? 0) > 0) todo.push(`${pendingSync?.c} event(s) pending cloud sync.`)

    if (handoff?.wrote) {
      lines.push(
        '- [x] Hand-off auto-synthesized (`context` · topic:`session-close` · source:`land-auto`). No `remember` required.',
        ''
      )
    } else if (handoff?.reason === 'nothing-to-land') {
      lines.push(
        '- [x] Nothing durable to hand off (no cycle / journal / commits / auto-captures).',
        ''
      )
    } else {
      todo.push(
        'Persist the hand-off: `prjct remember context "Session close: what changed, why, next" --tags topic:<key>`.'
      )
    }
    if (receipt?.wrote && receipt.summary) {
      lines.push(`- [x] ${receipt.summary} (tags: source:land-receipt · capture:receipt-v1).`, '')
    }

    // Dynasty D5: Rho dry-run — show memory mass Δ so vault never grows silently.
    let rhoLine: string | null = null
    try {
      const { runLandRhoDryRun } = await import('../services/land-rho')
      const rho = runLandRhoDryRun(proj.value)
      if (rho) {
        rhoLine = rho.line
        if (options.md) lines.push(rho.md)
        else lines.push(`- [x] ${rho.line}`, '')
      }
    } catch {
      /* best-effort */
    }

    // Claude Code steal: auto-dream when time+session gates open (bumps session
    // counter always). Best-effort — never block land.
    let dreamLine: string | null = null
    try {
      const { maybeDreamOnLand } = await import('../services/memory-dream')
      const dream = maybeDreamOnLand(proj.value)
      if (dream) {
        dreamLine = dream.line
        if (options.md) lines.push(dream.md)
        else if (dream.ran) lines.push(`- [x] ${dream.line}`, '')
        else if (!dream.skipped) lines.push(`- [x] ${dream.line}`, '')
        // Skipped dreams are silent on non-md land (session counter is enough).
      }
    } catch {
      /* best-effort */
    }

    // Always refresh L0 index on land when dream did not rebuild it.
    try {
      if (!dreamLine || !dreamLine.startsWith('Dream complete')) {
        const { buildAndStoreMemoryL0Index } = await import('../services/memory-index')
        buildAndStoreMemoryL0Index({ projectId: proj.value, source: 'land' })
      }
    } catch {
      /* best-effort */
    }

    todo.push(
      'Team share (optional): `prjct memory export` → commit `.prjct/memory-export/` → clone → `prjct memory import`.'
    )
    todo.push('Next window: `prjct prime --md` (managed session resume — not a blank chat).')
    lines.push(...todo.map((t) => `- [ ] ${t}`))

    if (continuityStamp) {
      const { formatLandContinuityFooter } = await import('../services/session-continuity')
      lines.push(formatLandContinuityFooter(continuityStamp))
    }

    console.log(lines.join('\n'))
    return {
      success: true,
      items: todo.length + (handoff?.wrote ? 1 : 0) + (receipt?.wrote ? 1 : 0),
      dream: dreamLine,
      handoff: handoff?.wrote ?? false,
      receipt: receipt?.wrote ?? false,
      receiptSummary: receipt?.summary ?? null,
      rhoDryRun: rhoLine,
      continuity: continuityStamp
        ? { landedAt: continuityStamp.landedAt, key: 'session:continuity' }
        : null,
    }
  }

  /**
   * Memory auto-dream — Claude Code KAIROS consolidation for prjct.
   * Gates: time (default 24h) + sessions (default 5 lands). Force with --force.
   * Dry-run with --dry-run. Rebuilds L0 memory index on success.
   */
  async dream(
    _input: string | null = null,
    projectPath: string = process.cwd(),
    options: CeremonyOptions = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result

    const { runMemoryDream } = await import('../services/memory-dream')
    const report = runMemoryDream({
      projectId: proj.value,
      projectPath,
      force: options.force === true,
      dryRun: options.dryRun === true,
      minHours: options.minHours,
      minSessions: options.minSessions,
    })

    if (options.md) {
      console.log(report.md)
      if (report.index?.markdown && report.ran) {
        console.log(report.index.markdown)
      }
    } else if (report.skipped) {
      out.info(report.line)
      out.info('Use `prjct dream --force` to run now, or `--dry-run` to preview.')
    } else {
      out.done(report.line)
    }

    return {
      success: true,
      ran: report.ran,
      skipped: report.skipped,
      dryRun: report.dryRun,
      reason: report.reason ?? null,
      line: report.line,
      archived: report.phases.consolidate.archived,
      deleted: report.phases.consolidate.deleted,
      indexLive: report.phases.prune.indexLive,
    }
  }

  private fail(msg: string, options: CeremonyOptions): CommandResult {
    if (options.md) console.log(`> ${msg}`)
    else out.fail(msg)
    return { success: false, error: msg }
  }
}
