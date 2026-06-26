/**
 * Product proof commands — concrete surfaces that show why prjct is worth
 * keeping around. These are intentionally read-mostly and provider-agnostic:
 * any coding agent can run them with `--md` and get the same project signal.
 */

import { detectAgentRuntimes } from '../infrastructure/agent-runtime-registry'
import type { MemoryEntry, MemoryType } from '../memory/entries'
import { deriveTitle, flatDetail, preventiveLabel } from '../memory/format'
import { projectMemory } from '../memory/project-memory'
import { resolveActiveTask } from '../services/task-service'
import prjctDb from '../storage/database'
import type { SqliteBindings } from '../storage/database/sqlite-compat'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { execFileAsync } from '../utils/exec'
import { failHard } from '../utils/md-aware'
import { PrjctCommandsBase } from './base'
import { requireProject } from './guards'

interface ProductOptions extends MdOption {
  days?: number
}

interface CountRow {
  value: number
}

interface TypeCountRow {
  type: string | null
  value: number
}

interface MemoryRow {
  id: string
  title: string | null
  content: string
  type: string | null
  tags: string | null
  created_at: string
}

interface TaskRow {
  id: string
  description: string
  status: string
  started_at?: string | null
  completed_at: string | null
  shipped_at: string | null
  tokens_in?: number | null
  tokens_out?: number | null
}

interface ShipRow {
  name: string
  shipped_at: string
  description: string | null
}

interface ValueSnapshot {
  memories: {
    live: number
    preventive: number
    useful: number
    surfaced: number
    inbox: number
  }
  workflow: {
    tasks: number
    completed: number
    shippedTasks: number
    shippedFeatures: number
    specs: number
    shippedSpecs: number
  }
  sync: {
    syncs: number
    tokensSaved: number
  }
  agents: {
    detected: number
    full: number
    good: number
    baseline: number
    hosted: number
  }
  score: number
}

interface PerformanceRow {
  id: string
  description: string
  status: string
  started_at: string | null
  completed_at: string | null
  shipped_at: string | null
  tokens_in: number | null
  tokens_out: number | null
  linked_spec_id?: string | null
}

interface PerformanceCycle {
  id: string
  description: string
  status: string
  minutes: number | null
  tokensIn: number | null
  tokensOut: number | null
  tokensTotal: number | null
  model: string
  runtime: string
  promptSynthesis: string
  outcome: string
}

const PREVENTIVE_TYPES = ['gotcha', 'anti-pattern', 'learning']
const NOISE_RE = /^(current work|wip|todo|misc|n\/a|none|latest|unreleased|changelog)$/i

export class ProductCommands extends PrjctCommandsBase {
  async insights(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: ProductOptions = {}
  ): Promise<CommandResult> {
    const [sub = 'overview', ...rest] = (input ?? '').trim().split(/\s+/).filter(Boolean)
    const forwarded = rest.join(' ') || null
    switch (sub) {
      case 'value':
      case 'overview':
        return this.value(null, projectPath, options)
      case 'quality':
      case 'memory':
      case 'memory-doctor':
        return this.memoryDoctor(null, projectPath, options)
      case 'report':
      case 'retro':
        return this.report(forwarded, projectPath, options)
      case 'continue':
      case 'handoff':
      case 'brief':
        return this.handoff(forwarded, projectPath, options)
      case 'guardrails':
      case 'risk':
        return this.guardrails(null, projectPath, options)
      default:
        return failHard(
          `Unknown insights view '${sub}'. Use value, quality, report, continue, or guardrails.`,
          options
        )
    }
  }

  async value(
    _input: string | null = null,
    projectPath: string = process.cwd(),
    options: ProductOptions = {}
  ): Promise<CommandResult> {
    try {
      const guard = await requireProject(projectPath, options)
      if (!guard.ok) return guard.result

      const snapshot = await buildValueSnapshot(guard.value, projectPath)
      console.log(options.md ? formatValueMd(snapshot) : formatValueText(snapshot))
      return { success: true, ...snapshot }
    } catch (error) {
      return failHard(getErrorMessage(error), options)
    }
  }

  async memoryDoctor(
    _input: string | null = null,
    projectPath: string = process.cwd(),
    options: ProductOptions = {}
  ): Promise<CommandResult> {
    try {
      const guard = await requireProject(projectPath, options)
      if (!guard.ok) return guard.result

      const report = buildMemoryDoctor(guard.value)
      console.log(options.md ? formatMemoryDoctorMd(report) : formatMemoryDoctorText(report))
      return { success: true, score: report.score, issues: report.issues.length }
    } catch (error) {
      return failHard(getErrorMessage(error), options)
    }
  }

  async report(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: ProductOptions = {}
  ): Promise<CommandResult> {
    try {
      const guard = await requireProject(projectPath, options)
      if (!guard.ok) return guard.result

      const days = pickDays(input, options.days, 7)
      const report = await buildHumanReport(guard.value, projectPath, days)
      console.log(options.md ? formatReportMd(report) : formatReportText(report))
      return { success: true, days, ships: report.ships.length, completed: report.completed.length }
    } catch (error) {
      return failHard(getErrorMessage(error), options)
    }
  }

  async handoff(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: ProductOptions = {}
  ): Promise<CommandResult> {
    try {
      const guard = await requireProject(projectPath, options)
      if (!guard.ok) return guard.result

      const target = (input ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? 'next agent'
      const handoff = await buildHandoff(guard.value, projectPath, target)
      console.log(options.md ? formatHandoffMd(handoff) : formatHandoffText(handoff))
      return { success: true, target, memories: handoff.memories.length }
    } catch (error) {
      return failHard(getErrorMessage(error), options)
    }
  }

  async guardrails(
    _input: string | null = null,
    projectPath: string = process.cwd(),
    options: ProductOptions = {}
  ): Promise<CommandResult> {
    try {
      const guard = await requireProject(projectPath, options)
      if (!guard.ok) return guard.result

      const report = await buildGuardrails(guard.value, projectPath)
      console.log(options.md ? formatGuardrailsMd(report) : formatGuardrailsText(report))
      return { success: true, files: report.files.length, hits: report.hits.length }
    } catch (error) {
      return failHard(getErrorMessage(error), options)
    }
  }

  async performance(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: ProductOptions = {}
  ): Promise<CommandResult> {
    try {
      const guard = await requireProject(projectPath, options)
      if (!guard.ok) return guard.result

      const days = pickDays(input, options.days, 14)
      const cycles = buildPerformanceCycles(guard.value, days)
      console.log(
        options.md ? formatPerformanceMd(days, cycles) : formatPerformanceText(days, cycles)
      )
      return { success: true, days, cycles: cycles.length }
    } catch (error) {
      return failHard(getErrorMessage(error), options)
    }
  }
}

async function buildValueSnapshot(projectId: string, projectPath: string): Promise<ValueSnapshot> {
  const statuses = await detectAgentRuntimes(projectPath)
  const levels = {
    detected: statuses.filter((s) => s.detected).length,
    full: statuses.filter((s) => s.supportLevel === 'full').length,
    good: statuses.filter((s) => s.supportLevel === 'good').length,
    baseline: statuses.filter((s) => s.supportLevel === 'baseline').length,
    hosted: statuses.filter((s) => s.supportLevel === 'hosted').length,
  }

  const memories = {
    live: count(projectId, 'SELECT COUNT(*) AS value FROM memories WHERE deleted_at IS NULL'),
    preventive: count(
      projectId,
      `SELECT COUNT(*) AS value FROM memories
       WHERE deleted_at IS NULL AND type IN ('gotcha', 'anti-pattern', 'learning')`
    ),
    useful: count(projectId, 'SELECT COUNT(*) AS value FROM memory_usefulness WHERE score > 0'),
    surfaced: count(projectId, 'SELECT COUNT(*) AS value FROM memory_surface_log'),
    inbox: count(
      projectId,
      `SELECT COUNT(*) AS value FROM memories WHERE deleted_at IS NULL AND type = 'inbox'`
    ),
  }

  const workflow = {
    tasks: count(projectId, 'SELECT COUNT(*) AS value FROM tasks'),
    completed: count(
      projectId,
      `SELECT COUNT(*) AS value FROM tasks WHERE status IN ('done', 'completed')`
    ),
    shippedTasks: count(
      projectId,
      'SELECT COUNT(*) AS value FROM tasks WHERE shipped_at IS NOT NULL'
    ),
    shippedFeatures: count(projectId, 'SELECT COUNT(*) AS value FROM shipped_features'),
    specs: count(projectId, 'SELECT COUNT(*) AS value FROM specs'),
    shippedSpecs: count(projectId, `SELECT COUNT(*) AS value FROM specs WHERE status = 'shipped'`),
  }

  const sync = {
    syncs: count(projectId, 'SELECT COALESCE(SUM(syncs), 0) AS value FROM metrics_daily'),
    tokensSaved: count(
      projectId,
      'SELECT COALESCE(SUM(tokens_saved), 0) AS value FROM metrics_daily'
    ),
  }

  return {
    memories,
    workflow,
    sync,
    agents: levels,
    score: valueScore(memories, workflow, sync, levels),
  }
}

function buildMemoryDoctor(projectId: string): {
  score: number
  byType: TypeCountRow[]
  issues: string[]
  duplicateGroups: number
  staleInbox: MemoryRow[]
  noise: MemoryRow[]
  missingType: number
  provenUseful: number
} {
  const byType = query<TypeCountRow>(
    projectId,
    `SELECT COALESCE(type, 'unknown') AS type, COUNT(*) AS value
     FROM memories
     WHERE deleted_at IS NULL
     GROUP BY COALESCE(type, 'unknown')
     ORDER BY value DESC, type ASC`
  )
  const duplicateGroups = count(
    projectId,
    `SELECT COUNT(*) AS value FROM (
       SELECT type, content_hash
       FROM memories
       WHERE deleted_at IS NULL AND content_hash IS NOT NULL
       GROUP BY type, content_hash
       HAVING COUNT(*) > 1
     )`
  )
  const staleInbox = query<MemoryRow>(
    projectId,
    `SELECT id, title, content, type, tags, created_at
     FROM memories
     WHERE deleted_at IS NULL
       AND type = 'inbox'
       AND created_at < datetime('now', '-14 days')
     ORDER BY created_at ASC
     LIMIT 8`
  )
  const rows = query<MemoryRow>(
    projectId,
    `SELECT id, title, content, type, tags, created_at
     FROM memories
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 500`
  )
  const noise = rows.filter((row) => isNoise(row.content)).slice(0, 8)
  const missingType = count(
    projectId,
    `SELECT COUNT(*) AS value FROM memories
     WHERE deleted_at IS NULL AND (type IS NULL OR type = '')`
  )
  const provenUseful = count(
    projectId,
    'SELECT COUNT(*) AS value FROM memory_usefulness WHERE score > 0'
  )

  const issues: string[] = []
  if (duplicateGroups > 0) issues.push(`${duplicateGroups} duplicate memory group(s) need review.`)
  if (staleInbox.length > 0) issues.push(`${staleInbox.length} old inbox item(s) need promotion.`)
  if (noise.length > 0)
    issues.push(`${noise.length} low-signal item(s) should be forgotten or rewritten.`)
  if (missingType > 0) issues.push(`${missingType} memory row(s) are missing a type.`)
  if (provenUseful === 0 && rows.length > 10) {
    issues.push('No memory has usefulness credit yet; run guard/context during real tasks.')
  }

  const penalty = duplicateGroups * 8 + staleInbox.length * 4 + noise.length * 6 + missingType * 5
  return {
    score: Math.max(0, Math.min(100, 100 - penalty)),
    byType,
    issues,
    duplicateGroups,
    staleInbox,
    noise,
    missingType,
    provenUseful,
  }
}

function buildPerformanceCycles(projectId: string, days: number): PerformanceCycle[] {
  const since = sinceIso(days)
  const rows = query<PerformanceRow>(
    projectId,
    `SELECT id, description, status, started_at, completed_at, shipped_at,
            tokens_in, tokens_out, linked_spec_id
     FROM tasks
     WHERE COALESCE(completed_at, shipped_at, started_at) >= ?
     ORDER BY COALESCE(completed_at, shipped_at, started_at) DESC
     LIMIT 20`,
    since
  )

  return rows.map((row) => {
    const tokensIn = nullableNumber(row.tokens_in)
    const tokensOut = nullableNumber(row.tokens_out)
    return {
      id: row.id,
      description: row.description,
      status: row.status,
      minutes: durationMinutes(row.started_at, row.completed_at ?? row.shipped_at),
      tokensIn,
      tokensOut,
      tokensTotal:
        tokensIn === null && tokensOut === null ? null : (tokensIn ?? 0) + (tokensOut ?? 0),
      model: 'unknown',
      runtime: 'unknown',
      promptSynthesis: synthesizePrompt(row.description),
      outcome: row.shipped_at ? 'shipped' : row.completed_at ? 'completed' : row.status,
    }
  })
}

async function buildHumanReport(projectId: string, projectPath: string, days: number) {
  const since = sinceIso(days)
  const active = await resolveActiveTask(projectId, projectPath).catch(() => null)
  const ships = query<ShipRow>(
    projectId,
    `SELECT name, shipped_at, description
     FROM shipped_features
     WHERE shipped_at >= ?
     ORDER BY shipped_at DESC
     LIMIT 8`,
    since
  )
  const completed = query<TaskRow>(
    projectId,
    `SELECT id, description, status, completed_at, shipped_at
     FROM tasks
     WHERE COALESCE(completed_at, shipped_at, started_at) >= ?
       AND status IN ('done', 'completed')
     ORDER BY COALESCE(completed_at, shipped_at, started_at) DESC
     LIMIT 10`,
    since
  )
  const decisions = projectMemory.recall(projectId, {
    types: ['decision', 'learning', 'gotcha'],
    limit: 8,
  })

  return {
    days,
    active,
    ships,
    completed,
    decisions,
    value: await buildValueSnapshot(projectId, projectPath),
  }
}

async function buildHandoff(projectId: string, projectPath: string, target: string) {
  const active = await resolveActiveTask(projectId, projectPath).catch(() => null)
  const memories = projectMemory.recall(projectId, {
    types: ['decision', 'gotcha', 'anti-pattern', 'pattern', 'learning'],
    limit: 10,
  })
  const statuses = await detectAgentRuntimes(projectPath)
  const detected = statuses.filter((status) => status.detected)
  return { target, active, memories, detected }
}

async function buildGuardrails(projectId: string, projectPath: string) {
  const files = await changedFiles(projectPath)
  const hits: Array<{ file: string; entry: MemoryEntry }> = []
  for (const file of files.slice(0, 40)) {
    const entries = projectMemory.recallForFile(projectId, file, 3)
    for (const entry of entries) hits.push({ file, entry })
  }

  const fallback =
    hits.length === 0
      ? projectMemory.recall(projectId, {
          types: PREVENTIVE_TYPES as MemoryType[],
          limit: 8,
        })
      : []
  return { files, hits, fallback }
}

async function changedFiles(projectPath: string): Promise<string[]> {
  const names = new Set<string>()
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--name-only', 'HEAD'], {
      cwd: projectPath,
    })
    for (const line of stdout.split('\n')) {
      const value = line.trim()
      if (value) names.add(value)
    }
  } catch {
    return []
  }
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: projectPath,
    })
    for (const line of stdout.split('\n')) {
      const value = line.trim()
      if (value) names.add(value)
    }
  } catch {
    // ignore untracked lookup failure
  }
  return [...names].sort()
}

function count(projectId: string, sql: string, ...params: SqliteBindings[]): number {
  try {
    return Number(prjctDb.get<CountRow>(projectId, sql, ...params)?.value ?? 0)
  } catch {
    return 0
  }
}

function query<T>(projectId: string, sql: string, ...params: SqliteBindings[]): T[] {
  try {
    return prjctDb.query<T>(projectId, sql, ...params)
  } catch {
    return []
  }
}

function valueScore(
  memories: ValueSnapshot['memories'],
  workflow: ValueSnapshot['workflow'],
  sync: ValueSnapshot['sync'],
  agents: ValueSnapshot['agents']
): number {
  const memory = Math.min(35, memories.live + memories.preventive * 2 + memories.useful * 3)
  const work = Math.min(
    30,
    workflow.completed * 2 + workflow.shippedFeatures * 4 + workflow.shippedSpecs * 3
  )
  const setup = Math.min(20, agents.detected * 3 + agents.full * 4 + agents.good * 2)
  const context = Math.min(15, sync.syncs + Math.floor(sync.tokensSaved / 25_000))
  return Math.min(100, memory + work + setup + context)
}

function pickDays(input: string | null, optionDays: number | undefined, fallback: number): number {
  if (typeof optionDays === 'number' && optionDays > 0) return Math.floor(optionDays)
  const match = (input ?? '').match(/\b(\d{1,3})\b/)
  if (!match) return fallback
  return Math.max(1, Math.min(90, Number.parseInt(match[1]!, 10)))
}

function sinceIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function durationMinutes(
  start: string | null | undefined,
  end: string | null | undefined
): number | null {
  if (!start || !end) return null
  const started = Date.parse(start)
  const ended = Date.parse(end)
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) return null
  return Math.round((ended - started) / 60_000)
}

function synthesizePrompt(description: string): string {
  const trimmed = description.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= 140) return trimmed
  return `${trimmed.slice(0, 137)}...`
}

function isNoise(content: string): boolean {
  const normalized = content.trim()
  return normalized.length <= 12 || NOISE_RE.test(normalized)
}

function formatValueMd(snapshot: ValueSnapshot): string {
  return [
    '# prjct Value',
    '',
    `**Value score:** ${snapshot.score}/100`,
    '',
    '| Area | Signal |',
    '|---|---:|',
    `| Live memories | ${snapshot.memories.live} |`,
    `| Preventive guardrails | ${snapshot.memories.preventive} |`,
    `| Proven-useful memories | ${snapshot.memories.useful} |`,
    `| Surfaced during active work | ${snapshot.memories.surfaced} |`,
    `| Completed tasks | ${snapshot.workflow.completed} / ${snapshot.workflow.tasks} |`,
    `| Shipped features | ${snapshot.workflow.shippedFeatures} |`,
    `| Specs shipped | ${snapshot.workflow.shippedSpecs} / ${snapshot.workflow.specs} |`,
    `| Sync runs | ${snapshot.sync.syncs} |`,
    `| Tokens saved by sync metrics | ${snapshot.sync.tokensSaved.toLocaleString()} |`,
    `| Detected agent runtimes | ${snapshot.agents.detected} |`,
    '',
    'Use this as the paid-tier proof screen: it measures continuity, prevention, reuse, and multi-agent setup from real project data.',
  ].join('\n')
}

function formatValueText(snapshot: ValueSnapshot): string {
  return [
    `prjct value: ${snapshot.score}/100`,
    `memory: ${snapshot.memories.live} live, ${snapshot.memories.preventive} preventive, ${snapshot.memories.useful} useful`,
    `workflow: ${snapshot.workflow.completed}/${snapshot.workflow.tasks} completed tasks, ${snapshot.workflow.shippedFeatures} ships`,
    `sync: ${snapshot.sync.syncs} runs, ${snapshot.sync.tokensSaved.toLocaleString()} tokens saved`,
    `agents: ${snapshot.agents.detected} detected runtimes`,
  ].join('\n')
}

function formatMemoryDoctorMd(report: ReturnType<typeof buildMemoryDoctor>): string {
  const lines = ['# Memory Doctor', '', `**Quality score:** ${report.score}/100`, '']
  lines.push('## Distribution', '', '| Type | Entries |', '|---|---:|')
  for (const row of report.byType) lines.push(`| ${row.type ?? 'unknown'} | ${row.value} |`)
  lines.push('', '## Issues')
  if (report.issues.length === 0) lines.push('', '- No obvious memory quality issues found.')
  else for (const issue of report.issues) lines.push(`- ${issue}`)
  lines.push('', '## Cleanup candidates')
  appendMemoryRows(lines, 'Old inbox', report.staleInbox)
  appendMemoryRows(lines, 'Low signal', report.noise)
  lines.push(
    '',
    'Recommended actions: promote old inbox entries into `decision`, `learning`, `gotcha`, or `todo`; forget noise by id; keep useful memories explicit and file-linked when possible.'
  )
  return lines.join('\n')
}

function formatMemoryDoctorText(report: ReturnType<typeof buildMemoryDoctor>): string {
  const lines = [`Memory doctor: ${report.score}/100`]
  if (report.issues.length === 0) lines.push('No obvious memory quality issues found.')
  else lines.push(...report.issues.map((issue) => `- ${issue}`))
  return lines.join('\n')
}

function formatReportMd(report: Awaited<ReturnType<typeof buildHumanReport>>): string {
  const lines = [`# Weekly Report (${report.days} days)`, '']
  lines.push(`**Value score:** ${report.value.score}/100`)
  lines.push(`**Active work cycle:** ${report.active?.description ?? 'None'}`, '')
  lines.push('## Shipped')
  if (report.ships.length === 0) lines.push('- No shipped features recorded in this window.')
  else {
    for (const ship of report.ships) {
      lines.push(
        `- **${ship.name}** — ${ship.description ?? 'No description'} (${ship.shipped_at})`
      )
    }
  }
  lines.push('', '## Completed Work')
  if (report.completed.length === 0)
    lines.push('- No completed work cycles recorded in this window.')
  else for (const task of report.completed) lines.push(`- ${task.description}`)
  lines.push('', '## Decisions / Lessons To Carry Forward')
  appendEntries(lines, report.decisions)
  return lines.join('\n')
}

function formatReportText(report: Awaited<ReturnType<typeof buildHumanReport>>): string {
  return [
    `Weekly report (${report.days} days)`,
    `Value: ${report.value.score}/100`,
    `Active: ${report.active?.description ?? 'None'}`,
    `Shipped: ${report.ships.length}`,
    `Completed: ${report.completed.length}`,
    `Carry-forward memories: ${report.decisions.length}`,
  ].join('\n')
}

function formatHandoffMd(handoff: Awaited<ReturnType<typeof buildHandoff>>): string {
  const lines = [
    `# Handoff for ${handoff.target}`,
    '',
    'Paste this into the next coding agent, then ask it to run the listed commands before editing.',
    '',
    '```text',
    `You are taking over this project with prjct available.`,
    `Active work cycle: ${handoff.active?.description ?? 'none'}.`,
    'First run:',
    '1. prjct work --md',
    '2. prjct insights value --md',
    '3. prjct insights quality --md',
    '4. prjct insights guardrails --md',
    '5. prjct performance --md',
    'Before editing any risky file, run prjct guard <file> --md.',
    '```',
    '',
    '## Detected runtimes',
    handoff.detected.length > 0
      ? handoff.detected.map((s) => `- ${s.runtime.displayName}: ${s.supportLevel}`).join('\n')
      : '- No runtime-specific signals detected; AGENTS.md remains the baseline.',
    '',
    '## Context to preserve',
  ]
  appendEntries(lines, handoff.memories)
  return lines.join('\n')
}

function formatHandoffText(handoff: Awaited<ReturnType<typeof buildHandoff>>): string {
  return [
    `Handoff for ${handoff.target}`,
    `Active: ${handoff.active?.description ?? 'none'}`,
    'Run: prjct work --md; prjct insights value --md; prjct insights guardrails --md; prjct performance --md',
    `Context entries: ${handoff.memories.length}`,
  ].join('\n')
}

function formatGuardrailsMd(report: Awaited<ReturnType<typeof buildGuardrails>>): string {
  const lines = ['# Risk Guardrails', '']
  lines.push(`Changed files checked: ${report.files.length}`)
  if (report.hits.length > 0) {
    lines.push('', '## File-specific warnings')
    for (const hit of report.hits) {
      lines.push(
        `- \`${hit.file}\`: **[${preventiveLabel(hit.entry)}] ${deriveTitle(hit.entry)}** — ${flatDetail(hit.entry.content)}  \`${hit.entry.id}\``
      )
    }
  } else {
    lines.push('', 'No file-specific preventive memory matched the current changeset.')
    if (report.fallback.length > 0) {
      lines.push('', '## General project traps')
      appendEntries(lines, report.fallback)
    }
  }
  lines.push('', '_Advisory only. This command does not block or mutate anything._')
  return lines.join('\n')
}

function formatGuardrailsText(report: Awaited<ReturnType<typeof buildGuardrails>>): string {
  if (report.hits.length === 0)
    return `Risk guardrails: ${report.files.length} files checked, no file-specific hits.`
  return `Risk guardrails: ${report.hits.length} warning(s) across ${report.files.length} changed file(s).`
}

function formatPerformanceMd(days: number, cycles: PerformanceCycle[]): string {
  const lines = ['# AI Agile Performance', '', `Window: last ${days} day(s)`, '']
  if (cycles.length === 0) {
    lines.push('No work cycles recorded in this window.')
    return lines.join('\n')
  }
  lines.push('| Work cycle | Outcome | Time | Tokens | Model | Runtime | Prompt synthesis |')
  lines.push('|---|---|---:|---:|---|---|---|')
  for (const cycle of cycles) {
    lines.push(
      `| ${escapeCell(cycle.description)} | ${cycle.outcome} | ${cycle.minutes ?? 'unknown'} | ${cycle.tokensTotal ?? 'unknown'} | ${cycle.model} | ${cycle.runtime} | ${escapeCell(cycle.promptSynthesis)} |`
    )
  }
  lines.push(
    '',
    'Model/runtime/tokens are `unknown` when the active editor does not expose them yet. Keep unknown explicit; do not infer.'
  )
  return lines.join('\n')
}

function formatPerformanceText(days: number, cycles: PerformanceCycle[]): string {
  if (cycles.length === 0) return `AI Agile performance (${days}d): no work cycles recorded.`
  const knownTime = cycles.filter((cycle) => cycle.minutes !== null)
  const minutes = knownTime.reduce((sum, cycle) => sum + (cycle.minutes ?? 0), 0)
  return `AI Agile performance (${days}d): ${cycles.length} cycle(s), ${knownTime.length} with duration, ${minutes} known minute(s).`
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function appendEntries(lines: string[], entries: MemoryEntry[]): void {
  if (entries.length === 0) {
    lines.push('- None recorded yet.')
    return
  }
  for (const entry of entries) {
    lines.push(
      `- **[${entry.type}] ${deriveTitle(entry)}** — ${flatDetail(entry.content)}  \`${entry.id}\``
    )
  }
}

function appendMemoryRows(lines: string[], title: string, rows: MemoryRow[]): void {
  lines.push('', `### ${title}`)
  if (rows.length === 0) {
    lines.push('- None.')
    return
  }
  for (const row of rows) {
    lines.push(
      `- **${row.type ?? 'unknown'}** ${row.title ?? row.content.slice(0, 80)}  \`${row.id}\``
    )
  }
}
