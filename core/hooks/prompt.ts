/**
 * UserPromptSubmit hook — lean project-state injection only.
 *
 * Fires when the human submits a prompt and injects pure facts about where
 * the project is right now (active task, branch, working tree, recent ships)
 * so the LLM can disambiguate intent without asking ("listo" + dirty tree +
 * active task + unpushed commits → ship; clean tree → status done).
 *
 * Topical memory and improvement signals are PULL, not PUSH: the agent
 * fetches them on demand (`prjct context memory <topic>`, `prjct guard
 * <file>`, MCP recall). Per-turn keyword-matched recall used to match on
 * stopwords/noise and burn the context window with entries the turn never
 * needed — exactly the bloat we refuse to ship to clients.
 *
 * ONE exception to PULL: preventive knowledge. When the prompt's keywords
 * BM25-match a `gotcha`/`anti-pattern`, a single one-line trap cue rides
 * along — the same class the pre-edit guard pushes, because a trap only
 * helps BEFORE it's stepped in. Decisions/learnings/facts stay pull-only.
 *
 * Zero "do X" prescription. The LLM decides. Degrades gracefully: on any
 * error (no project, no git) we emit `{}` and stay out of the way.
 */

import path from 'node:path'
import configManager from '../infrastructure/config-manager'
import { deriveTitle } from '../memory/format'
import { projectMemory } from '../memory/project-memory'
import { collectActiveTasks } from '../services/task-overview'
import { shippedStorage } from '../storage/shipped-storage'
import type { LocalConfig } from '../types/config'
import { execFileAsync } from '../utils/exec'
import { fileExists } from '../utils/file-helper'
import { type HookIo, runHook } from './_runner'
import { extractKeywords, safeTruncate } from './_shared'

const STATE_BUDGET = 900
/** FTS candidates fetched before the preventive-type filter picks ONE. */
const CUE_CANDIDATES = 8

interface HookInput {
  prompt?: string
}

/**
 * Build a "# prjct: project state" block — pure facts about where the
 * project is right now (active task, branch, working tree, recent
 * ships). The LLM reads it to disambiguate user intent without asking.
 *
 * Returns null when there's nothing useful to say (no project, no
 * git repo) so the caller can skip injection entirely.
 */
export async function buildProjectState(
  projectPath: string,
  preloaded?: LocalConfig | null
): Promise<string | null> {
  const config = preloaded !== undefined ? preloaded : await configManager.readConfig(projectPath)
  if (!config?.projectId) return null

  const lines: string[] = ['# prjct: project state']
  let hasContent = false

  // Active task — most useful single fact. Resolved PER worktree so a parallel
  // agent sees its own task, not a sibling's. Falls back to singular outside a
  // worktree.
  try {
    const overview = await collectActiveTasks(config.projectId, projectPath)
    if (overview.current) {
      const startedAgo = formatRelative(overview.current.startedAt)
      lines.push(
        `- Active task: "${overview.current.description}" (${startedAgo}) [${overview.current.label}]`
      )
      hasContent = true
    }
    const others = overview.all.filter((v) => !v.isCurrent)
    if (others.length > 0) {
      lines.push(`- ${others.length} task(s) active in other workspace(s)`)
      hasContent = true
    }
  } catch {
    /* best-effort */
  }

  // Git state — branch, working tree summary, ahead-of-origin count.
  // Each git call is wrapped — empty repo / missing git / network all
  // become "no signal" rather than errors.
  if (await fileExists(path.join(projectPath, '.git'))) {
    const git = await captureGit(projectPath)
    if (git.branch) {
      const wtBits: string[] = []
      if (git.modified > 0) wtBits.push(`${git.modified} modified`)
      if (git.staged > 0) wtBits.push(`${git.staged} staged`)
      if (git.untracked > 0) wtBits.push(`${git.untracked} untracked`)
      const wt = wtBits.length > 0 ? wtBits.join(', ') : 'clean'
      const ahead = git.ahead > 0 ? `, ${git.ahead} unpushed` : ''
      lines.push(`- Branch: ${git.branch} — working tree ${wt}${ahead}`)
      hasContent = true
    }
  }

  // Last shipped — useful for "what's the diff since last release?" intuition.
  try {
    const recent = await shippedStorage.getRecent(config.projectId, 1)
    if (recent.length > 0) {
      const last = recent[0]!
      const ago = formatRelative(last.shippedAt ?? '')
      const label = last.version ? `v${last.version}` : last.name
      lines.push(`- Last ship: ${label} (${ago})`)
      hasContent = true
    }
  } catch {
    /* best-effort */
  }

  // Inbox depth — pure count, signals "you have things to triage". A direct
  // COUNT (not a 200-row overfetch + deserialize just to read `.length`), and
  // it reports the true count instead of capping at the old limit of 50.
  try {
    const inboxCount = projectMemory.countByType(config.projectId, 'inbox')
    if (inboxCount > 0) {
      lines.push(`- Inbox: ${inboxCount} items pending`)
      hasContent = true
    }
  } catch {
    /* best-effort */
  }

  if (!hasContent) return null
  return lines.join('\n')
}

/**
 * At most ONE preventive entry (gotcha / anti-pattern) whose content
 * BM25-matches the prompt's keywords, as a one-line cue. Best-effort —
 * any failure returns null and the state block ships without it.
 */
export function buildTopicalCue(projectId: string, prompt: string): string | null {
  try {
    const keywords = extractKeywords(prompt)
    if (keywords.length === 0) return null
    const hits = projectMemory.searchFts(projectId, keywords, CUE_CANDIDATES)
    const trap = hits.find((e) => e.type === 'gotcha' || e.type === 'anti-pattern')
    if (!trap) return null
    return `> Trap on this topic: ${deriveTitle(trap)}  \`${trap.id}\``
  } catch {
    return null
  }
}

interface GitSnapshot {
  branch: string
  modified: number
  staged: number
  untracked: number
  ahead: number
}

// The daemon serves hooks from a long-lived process, so agentic bursts
// (dozens of prompts per minute) would fork `git status` dozens of times
// for a snapshot that can't meaningfully change between turns. A short
// TTL bounds staleness to 3s — far below the rate at which branch/staged
// state matters in the injected one-liner — and drops the fork rate from
// O(prompts) to at most one burst per TTL window per cwd.
const GIT_SNAPSHOT_TTL_MS = 3000
const gitSnapshotCache = new Map<string, { snapshot: GitSnapshot; expiresAt: number }>()

/** Test-only: drop cached git snapshots so a test can observe fresh state. */
export function _resetGitSnapshotCacheForTests(): void {
  gitSnapshotCache.clear()
}

async function captureGit(projectPath: string): Promise<GitSnapshot> {
  const cached = gitSnapshotCache.get(projectPath)
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot

  const snapshot = await captureGitUncached(projectPath)
  // Bound the map: hooks only ever run for a handful of cwds per daemon,
  // but a runaway caller must not grow this unbounded.
  if (gitSnapshotCache.size > 32) gitSnapshotCache.clear()
  gitSnapshotCache.set(projectPath, { snapshot, expiresAt: Date.now() + GIT_SNAPSHOT_TTL_MS })
  return snapshot
}

async function captureGitUncached(projectPath: string): Promise<GitSnapshot> {
  const empty: GitSnapshot = { branch: '', modified: 0, staged: 0, untracked: 0, ahead: 0 }
  const safe = async (args: string[]): Promise<string> => {
    try {
      const r = await execFileAsync('git', args, { cwd: projectPath, timeout: 2000 })
      return r.stdout.trim()
    } catch {
      return ''
    }
  }

  // Hook fires on every prompt; 3 sequential git forks cost ~15-45ms.
  // Running them in parallel collapses to a single round-trip (~5-15ms).
  // `@{u}` returns empty when no upstream is set; treat as 0 unpushed.
  const [branch, status, aheadStr] = await Promise.all([
    safe(['branch', '--show-current']),
    safe(['status', '--porcelain']),
    safe(['rev-list', '--count', '@{u}..HEAD']),
  ])
  if (!branch) return empty

  let modified = 0
  let staged = 0
  let untracked = 0
  for (const line of status.split('\n')) {
    if (!line) continue
    const code = line.slice(0, 2)
    if (code.startsWith('??')) untracked++
    else {
      if (code[0] !== ' ' && code[0] !== '?') staged++
      if (code[1] !== ' ') modified++
    }
  }

  const ahead = Number.parseInt(aheadStr, 10) || 0

  return { branch, modified, staged, untracked, ahead }
}

function formatRelative(isoTimestamp: string): string {
  if (!isoTimestamp) return 'unknown'
  const t = Date.parse(isoTimestamp)
  if (Number.isNaN(t)) return 'unknown'
  const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function runPromptHook(projectPath: string = process.cwd(), io?: HookIo): Promise<void> {
  return runHook<HookInput>(
    {
      event: 'UserPromptSubmit',
      projectPath,
      build: async (input, p) => {
        const prompt = (input.prompt ?? '').trim()
        if (!prompt) return null
        const config = await configManager.readConfig(p)
        // PUSH→PULL: the per-turn hook injects ONLY lean project-state facts
        // (active task, branch, working tree) so the agent can disambiguate
        // intent without asking. Topical memory and improvement signals are
        // PULL, not PUSH — the agent fetches them on demand via
        // `prjct context memory <topic>`, `prjct guard <file>`, or the MCP
        // recall tools. Pushing keyword-matched memory into every prompt
        // matched on stopwords/noise and burned the context window with
        // entries the turn never needed.
        const state = await buildProjectState(p, config)
        if (!state) return null
        // The ONE push exception: a single trap cue when the prompt's
        // keywords hit a gotcha/anti-pattern (see header). State leads;
        // the cue is appended and shares the same hard budget.
        const cue = config?.projectId ? buildTopicalCue(config.projectId, prompt) : null
        return safeTruncate(cue ? `${state}\n\n${cue}` : state, STATE_BUDGET)
      },
    },
    io
  )
}
