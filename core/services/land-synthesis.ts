/**
 * Land auto-synthesis — write a Session-close hand-off without asking the
 * agent to type `prjct remember context "…"`.
 *
 * Competitive gap vs memory plugins that force the model to remember to
 * remember: prjct does the hand-off at `prjct land` and (best-effort) at
 * Stop when a cycle is still open. Deterministic synthesis from durable
 * signals (cycle, journal, recent commits, recent auto-captures) — not a
 * model call — so it works on weak models and never blocks session end.
 */

import { execFileSync } from 'node:child_process'
import { projectMemory } from '../memory/project-memory'
import { prjctDb } from '../storage/database'
import { collectActiveTasks } from './task-overview'

const SOURCE_TAG = 'land-auto'
const TOPIC_KEY = 'session-close'

export interface LandSynthesisResult {
  wrote: boolean
  content: string | null
  reason?: string
}

export interface LandSynthesisInput {
  projectId: string
  projectPath: string
  /** When set, prefer this over a live task lookup (Stop already has overview). */
  cycleDescription?: string | null
  cycleId?: string | null
  author?: string
  model?: string
  tokensIn?: number
  tokensOut?: number
}

/**
 * Build + persist a living-context Session close entry.
 * Idempotent per (type=context, content hash) and topic upsert.
 */
export async function synthesizeLandHandoff(
  input: LandSynthesisInput
): Promise<LandSynthesisResult> {
  const content = buildLandHandoffContent(input)
  if (!content) {
    return { wrote: false, content: null, reason: 'nothing-to-land' }
  }

  try {
    await projectMemory.remember(input.projectPath, {
      type: 'context',
      content,
      tags: {
        source: SOURCE_TAG,
        topic: TOPIC_KEY,
        capture: 'land-v1',
      },
      provenance: 'extracted',
      projectId: input.projectId,
    })
    return { wrote: true, content }
  } catch (err) {
    return {
      wrote: false,
      content,
      reason: `remember-failed: ${(err as Error).message}`,
    }
  }
}

/**
 * Pure builder — exported for unit tests. Returns null when there is no
 * durable signal worth persisting (no cycle, no journal, no commits).
 */
export function buildLandHandoffContent(input: LandSynthesisInput): string | null {
  const cycle =
    input.cycleDescription?.trim() ||
    // sync lookup only when caller did not pass cycle
    null
  const journal = recentJournal(input.projectId, input.cycleId)
  const commits = recentCommits(input.projectPath)
  const autos = recentAutoCaptures(input.projectId)

  // Without any of these, a hand-off is empty noise.
  if (!cycle && journal.length === 0 && commits.length === 0 && autos.length === 0) {
    return null
  }

  const what = cycle
    ? `Work cycle "${truncate(cycle, 120)}" still open or just closed.`
    : 'Session closed with no open work cycle.'
  const why =
    journal.length > 0
      ? `Journal trail: ${journal.map((j) => truncate(j, 80)).join(' · ')}`
      : 'No task journal entries; synthesis from repo + auto-captures only.'
  const outcome =
    commits.length > 0
      ? `Recent commits: ${commits.join('; ')}`
      : 'No recent git commits visible from project path.'
  const traps =
    autos.length > 0
      ? autos
          .slice(0, 4)
          .map((a) => `[${a.type}] ${truncate(a.content, 100)}`)
          .join(' · ')
      : 'none auto-captured this window'
  const tokens =
    input.tokensIn != null || input.tokensOut != null
      ? `in=${input.tokensIn ?? 0} out=${input.tokensOut ?? 0}`
      : 'unknown'
  const next =
    cycle != null
      ? 'Finish or pause the open cycle (`prjct status done` / `prjct pause`); next agent should `prjct work --md` or `prjct prime`.'
      : 'Next agent: `prjct prime` then pick from `prjct next --md`.'

  return [
    `Session close: ${what}`,
    `Context synthesis: Passive land hand-off — durable signals only (cycle, journal, commits, auto-captures). Not a model essay.`,
    `Key data: source=${SOURCE_TAG}; topic=${TOPIC_KEY}`,
    `What happened: ${what}`,
    `Why it mattered: ${why}`,
    `Who/author: ${input.author ?? 'unknown'}`,
    `Model: ${input.model ?? 'unknown'}`,
    `Token usage: ${tokens}`,
    `Sentiment: unknown`,
    `Related files: unknown`,
    `Feature/domain: session-close`,
    `Pattern: land auto-synthesis without agent remember`,
    `Anti-pattern: relying on the model to remember to remember at session end`,
    `Decision/trap: ${traps}`,
    `Outcome: ${outcome}`,
    `Next implication: ${next}`,
  ].join(' · ')
}

/** Async wrapper that fills cycle from active task when omitted. */
export async function synthesizeLandHandoffFromProject(
  projectId: string,
  projectPath: string,
  extras: Omit<
    LandSynthesisInput,
    'projectId' | 'projectPath' | 'cycleDescription' | 'cycleId'
  > = {}
): Promise<LandSynthesisResult> {
  const overview = await collectActiveTasks(projectId, projectPath).catch(() => null)
  return synthesizeLandHandoff({
    projectId,
    projectPath,
    cycleDescription: overview?.current?.description ?? null,
    cycleId: overview?.current?.id ?? null,
    ...extras,
  })
}

function recentJournal(projectId: string, cycleId: string | null | undefined): string[] {
  try {
    if (cycleId) {
      return prjctDb
        .query<{ content: string }>(
          projectId,
          'SELECT content FROM task_log WHERE task_id = ? ORDER BY id DESC LIMIT 5',
          cycleId
        )
        .map((r) => r.content)
    }
    return prjctDb
      .query<{ content: string }>(
        projectId,
        'SELECT content FROM task_log ORDER BY id DESC LIMIT 5'
      )
      .map((r) => r.content)
  } catch {
    return []
  }
}

function recentCommits(projectPath: string): string[] {
  try {
    const out = execFileSync('git', ['log', '-5', '--oneline', '--no-decorate'], {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function recentAutoCaptures(projectId: string): Array<{ type: string; content: string }> {
  try {
    const rows = prjctDb.query<{ type: string; content: string }>(
      projectId,
      `SELECT me.type, me.content
       FROM memory_entries me
       JOIN memory_entry_tags t ON t.entry_id = me.id
       WHERE me.deleted_at IS NULL
         AND t.key = 'source'
         AND t.value IN ('transcript-auto', 'land-auto')
       ORDER BY me.created_at DESC
       LIMIT 8`
    )
    return rows.map((r) => ({ type: r.type, content: r.content }))
  } catch {
    return []
  }
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}
