/**
 * UserPromptSubmit hook — topical memory recall + project state.
 *
 * Fires when the human submits a prompt. Two passes:
 *   1. State injection — active task, branch, working tree, recent
 *      ships. The LLM uses this to disambiguate intent ("listo" with
 *      a dirty tree + active task + unpushed commits → ship; "listo"
 *      with clean tree → status done).
 *   2. Topical memory recall — keyword-match against the vault.
 *
 * Both pure facts. Zero "do X" prescription. The LLM decides.
 *
 * Degrades gracefully: on any error (bindings missing, no project,
 * no matches), we emit `{}` and stay out of the way.
 */

import path from 'node:path'
import configManager from '../infrastructure/config-manager'
import { formatMemoryMd, type MemoryEntry, projectMemory } from '../memory/project-memory'
import { shippedStorage } from '../storage/shipped-storage'
import { stateStorage } from '../storage/state-storage'
import { execFileAsync } from '../utils/exec'
import { fileExists } from '../utils/file-helper'
import { buildHookOutput, emit, extractKeywords, readStdinSafe, safeRun } from './_shared'

const MAX_CHARS = 1800
const MAX_ENTRIES = 4

interface HookInput {
  prompt?: string
}

/**
 * Return recalled memories as markdown, or null if nothing relevant.
 * Exported for tests + for callers that want the string without the
 * hook envelope.
 */
async function buildPromptContext(projectPath: string, prompt: string): Promise<string | null> {
  const config = await configManager.readConfig(projectPath)
  if (!config?.projectId) return null

  const keywords = extractKeywords(prompt)
  if (keywords.length === 0) return null

  // Single recall + in-memory filter on keyword union. The previous
  // implementation called recall() once per keyword (up to 8 times),
  // each re-running the same two SQL queries — a hot-path waste since
  // recall ignores the `topic` filter at the SQL level (it filters
  // post-fetch). One query, recency-sorted, take the first N hits.
  const lowerKeywords = keywords.map((k) => k.toLowerCase())
  let pool: MemoryEntry[] = []
  try {
    pool = projectMemory.recall(config.projectId, { limit: MAX_ENTRIES * 4 })
  } catch {
    return null
  }
  const matches: MemoryEntry[] = []
  for (const e of pool) {
    const hay = `${e.content} ${Object.values(e.tags).join(' ')}`.toLowerCase()
    if (!lowerKeywords.some((kw) => hay.includes(kw))) continue
    matches.push(e)
    if (matches.length >= MAX_ENTRIES) break
  }

  if (matches.length === 0) return null

  const lines = ['# prjct: topical memory']
  lines.push('')
  lines.push(
    `Recalled ${matches.length} entr${matches.length === 1 ? 'y' : 'ies'} matching: ${keywords.slice(0, 3).join(', ')}`
  )
  lines.push('')
  lines.push(formatMemoryMd(matches))
  lines.push('')
  lines.push('> Exposed as state. Use if relevant; ignore if not.')
  const body = lines.join('\n')
  return body.length > MAX_CHARS ? `${body.slice(0, MAX_CHARS - 20)}\n… [truncated]` : body
}

/**
 * Build a "# prjct: project state" block — pure facts about where the
 * project is right now (active task, branch, working tree, recent
 * ships). The LLM reads it to disambiguate user intent without asking.
 *
 * Returns null when there's nothing useful to say (no project, no
 * git repo) so the caller can skip injection entirely.
 */
export async function buildProjectState(projectPath: string): Promise<string | null> {
  const config = await configManager.readConfig(projectPath)
  if (!config?.projectId) return null

  const lines: string[] = ['# prjct: project state']
  let hasContent = false

  // Active task — most useful single fact.
  try {
    const activeTask = await stateStorage.getCurrentTask(config.projectId)
    if (activeTask) {
      const startedAgo = formatRelative(activeTask.startedAt)
      lines.push(`- Active task: "${activeTask.description}" (${startedAgo})`)
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

  // Inbox depth — pure count, signals "you have things to triage".
  try {
    const inboxEntries = projectMemory.recall(config.projectId, {
      types: ['inbox'],
      limit: 50,
    })
    if (inboxEntries.length > 0) {
      lines.push(`- Inbox: ${inboxEntries.length} items pending`)
      hasContent = true
    }
  } catch {
    /* best-effort */
  }

  if (!hasContent) return null
  return lines.join('\n')
}

interface GitSnapshot {
  branch: string
  modified: number
  staged: number
  untracked: number
  ahead: number
}

async function captureGit(projectPath: string): Promise<GitSnapshot> {
  const empty: GitSnapshot = { branch: '', modified: 0, staged: 0, untracked: 0, ahead: 0 }
  const safe = async (args: string[]): Promise<string> => {
    try {
      const r = await execFileAsync('git', args, { cwd: projectPath, timeout: 2000 })
      return r.stdout.trim()
    } catch {
      return ''
    }
  }

  const branch = await safe(['branch', '--show-current'])
  if (!branch) return empty

  const status = await safe(['status', '--porcelain'])
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

  // Unpushed commits vs upstream. `@{u}` returns empty when no upstream
  // is configured (fresh local branch); treat as 0.
  const aheadStr = await safe(['rev-list', '--count', '@{u}..HEAD'])
  const ahead = Number.parseInt(aheadStr, 10) || 0

  return { branch, modified, staged, untracked, ahead }
}

/**
 * Read the most recent improvement-signals captured by the friction
 * detector at the previous session's Stop hook. Surfaces ONCE per
 * signal: as soon as the LLM (or the user) acts on a signal, it
 * should be addressed — repeated injection across turns is noise.
 *
 * Implementation note: we cap surfacing at the 3 newest signals from
 * the last 24h, so a single noisy session can't flood the prompt
 * context indefinitely.
 */
export async function buildImprovementSignals(projectPath: string): Promise<string | null> {
  const config = await configManager.readConfig(projectPath)
  if (!config?.projectId) return null

  let signals: MemoryEntry[] = []
  try {
    signals = projectMemory.recall(config.projectId, {
      types: ['improvement-signal'],
      tags: { source: 'friction-detector' },
      limit: 8,
    })
  } catch {
    return null
  }
  if (signals.length === 0) return null

  // Keep only signals from the last 24h. Older ones either got
  // addressed or aren't pressing — surfacing them on every turn
  // forever would be noise.
  const recentCutoff = Date.now() - 24 * 60 * 60 * 1000
  const recent = signals.filter((e) => Date.parse(e.rememberedAt) > recentCutoff).slice(0, 3)
  if (recent.length === 0) return null

  const lines: string[] = ['# prjct: improvement signals (from prior session)']
  lines.push('')
  lines.push(
    `${recent.length} friction moment${recent.length === 1 ? '' : 's'} captured at last session-end. Consider whether any of these are relevant to what the user is asking now — if so, propose a fix proactively. Otherwise ignore.`
  )
  lines.push('')
  for (const e of recent) {
    const category = e.tags.category ?? 'unknown'
    const oneLine = e.content.split('\n')[0] ?? ''
    lines.push(`- [${category}] ${oneLine}`)
  }
  lines.push('')
  lines.push(
    '> If the user explicitly addresses one, drop it from rotation by `prjct remember decision "<resolution>" --tags resolves:improvement-signal`.'
  )
  return lines.join('\n')
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

export async function runPromptHook(projectPath: string = process.cwd()): Promise<void> {
  await safeRun(async () => {
    const input = await readStdinSafe<HookInput>()
    const prompt = (input.prompt ?? '').trim()
    if (!prompt) {
      emit({})
      return
    }
    // Three pass: state (for intent disambiguation) + memory (for topical
    // recall) + improvement signals (proactive UX nudges from prior
    // sessions). All independent, each silently null'd on failure.
    const [state, memory, signals] = await Promise.all([
      buildProjectState(projectPath),
      buildPromptContext(projectPath, prompt),
      buildImprovementSignals(projectPath),
    ])
    const blocks = [state, signals, memory].filter((b): b is string => Boolean(b))
    if (blocks.length === 0) {
      emit(buildHookOutput('UserPromptSubmit', null))
      return
    }
    let context = blocks.join('\n\n')
    if (context.length > MAX_CHARS) {
      context = `${context.slice(0, MAX_CHARS - 20)}\n… [truncated]`
    }
    emit(buildHookOutput('UserPromptSubmit', context))
  })
}
