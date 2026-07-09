/**
 * SessionStart hook — injects persona as additionalContext.
 *
 * Anti-harness contract: this hook **describes state**, never prescribes
 * action. Output is a short markdown block Claude reads as WHAT, not HOW.
 * No "first do X, then Y" — just "here's who you are". Claude decides
 * everything else.
 *
 * Claude Code invokes this via `prjct hook session-start`. Contract:
 *   stdin:  JSON with `source` ("startup" | "resume" | "clear" | "compact")
 *   stdout: JSON { hookSpecificOutput: { hookEventName, additionalContext } }
 *   exit 0: success (even when nothing to inject — emits `{}` instead).
 *
 * # Cache stability
 *
 * The output is also reused by `subagent-start` and `cwd-changed`, both
 * of which can fire mid-session. Anthropic's prompt cache hashes the
 * system-prompt prefix as a single block — every byte that changes
 * between turns invalidates the entire cached prefix and forces a full
 * re-tokenization at the un-cached input rate (10× cost).
 *
 * For that reason this hook is intentionally **bytes-identical given
 * the same persona**. An earlier version interpolated "Recent memory"
 * (the last 5 captured entries) into the body, which meant every
 * `prjct remember`, legacy inbox capture, or `prjct ship` between sessions
 * shifted the bytes and busted the cache on resume / cwd change /
 * subagent spawn. Per-turn topical recall already happens in the
 * UserPromptSubmit hook (`core/hooks/prompt.ts`) and on demand via
 * `prjct context memory <topic>` — that's the right place for
 * variable, prompt-relevant content.
 */

import configManager from '../infrastructure/config-manager'
import { isSyncCurrent, runSelfHeal } from '../infrastructure/self-heal'
import type { MemoryEntry } from '../memory/entries'
import { deriveTitle } from '../memory/format'
import { projectMemory } from '../memory/project-memory'
import { recordAgentSessionStart } from '../services/agent-session-recorder'
import { extractDeveloperRules } from '../services/developer-profile'
import { createStalenessChecker } from '../services/staleness-checker'
import { usefulnessService } from '../services/usefulness'
import type { LocalConfig, ProjectPersona } from '../types/config'
import { VERSION } from '../utils/version'
import { type HookIo, runHook } from './_runner'
import { safeTruncate } from './_shared'

interface HookInput {
  source?: 'startup' | 'resume' | 'clear' | 'compact'
  session_id?: string
}

interface SessionContextOptions {
  /**
   * Append the project-knowledge digest (top gotchas + decisions + developer
   * profile pointer). OFF by default — see the cache-stability note below.
   * Only the cold-start sources (`startup`/`clear`/`compact`) pass `true`.
   */
  digest?: boolean
}

const DIGEST_MAX_CHARS = 1600
const DIGEST_PER_TYPE = 3
/** How many developer rules to push on cold start (apply without MCP pull). */
const DIGEST_DEV_RULES = 4

/**
 * Build the additionalContext body for the current project.
 *
 * `preloadedConfig` lets the caller skip a duplicate disk read — the
 * hook entry point reads config once and passes it down. Tests can
 * keep calling this with just `projectPath` and we'll read it ourselves.
 *
 * # Why the digest is gated (cache stability)
 *
 * The persona block is intentionally byte-identical across turns: this
 * output is reused by `subagent-start` and `cwd-changed` (which fire
 * mid-session), and any byte change busts Anthropic's cached system-prompt
 * prefix (10× re-tokenization cost). The variable knowledge digest is
 * therefore injected ONLY on cold-start sources — `startup`/`clear`/
 * `compact` — where the context is being built fresh anyway (no warm prefix
 * to bust) and grounding matters most: a freshly-updated model starts blank
 * and SQLite-backed memory is the only thing that survived the update. The
 * mid-session reusers call this with `digest` unset → persona-only, byte-identical.
 */
export async function buildSessionContext(
  projectPath: string,
  preloadedConfig?: LocalConfig | null,
  opts: SessionContextOptions = {}
): Promise<string | null> {
  const config = preloadedConfig ?? (await configManager.readConfig(projectPath))
  if (!config?.projectId) return null

  const persona = config.persona
  const digest = opts.digest ? buildKnowledgeDigest(config.projectId) : null
  // Continuous understanding — once per session, flag genuine drift since the
  // last sync so the model refreshes the architecture/risks map instead of
  // trusting a frozen snapshot for the session's big calls.
  const staleness = await buildStalenessNotice(projectPath, config.projectId)
  // One-time heads-up for a project that had vault export switched on.
  const { vaultRetirementNotice } = await import('../services/vault-retire-notice')
  const vaultNotice = await vaultRetirementNotice(config, config.projectId)
  // Session-close ritual cue when a cycle is still open.
  let landCue: string | null = null
  try {
    const { buildLandCue } = await import('../services/land-cue')
    landCue = await buildLandCue(config.projectId, projectPath, config)
  } catch {
    landCue = null
  }

  // Nothing to say (no persona, no knowledge, no drift) → stay silent.
  if (!persona && !digest && !staleness && !vaultNotice && !landCue) return null

  const sections: string[] = ['# prjct: project context', '']
  if (persona) {
    // One advisory line only — the recall verbs already live in the skill's
    // Primitives section; repeating them here cost tokens on every cold
    // start for zero new information (token-cache audit R5).
    sections.push(
      formatPersona(persona),
      '',
      '> Exposed as state, not prescription. Decide whether any of this matters for the current turn.'
    )
  }
  if (digest) {
    if (persona) sections.push('')
    sections.push(digest)
  }
  if (staleness) {
    if (persona || digest) sections.push('')
    sections.push(staleness)
  }
  if (vaultNotice) {
    if (persona || digest || staleness) sections.push('')
    sections.push(vaultNotice)
  }
  if (landCue) {
    if (persona || digest || staleness || vaultNotice) sections.push('')
    sections.push(landCue)
  }
  return sections.join('\n')
}

/**
 * One-line drift notice: surfaced only on GENUINE staleness — code actually
 * changed since a real sync AND it crossed the threshold. The never-synced
 * bootstrap nag belongs to onboarding, not every session, so commitsSinceSync
 * must be > 0. Best-effort; never blocks the session block.
 */
async function buildStalenessNotice(
  projectPath: string,
  projectId: string
): Promise<string | null> {
  try {
    const checker = createStalenessChecker(projectPath)
    const status = await checker.check(projectId)
    if (!status.isStale || status.commitsSinceSync <= 0) return null
    const warning = checker.getWarning(status)
    if (!warning) return null
    return `**Understanding may be stale:** ${warning} — the architecture/risks map was built at the last sync; refresh before trusting it for big calls.`
  } catch {
    return null
  }
}

/**
 * Compact, high-signal recall of what the project + developer already know —
 * cross-model-update grounding. Top traps + decisions + distilled developer
 * rules (apply-loop: push enough to act without pull instinct). Recency-
 * ranked with usefulness rerank; tightly truncated.
 */
function buildKnowledgeDigest(projectId: string): string | null {
  let gotchas: MemoryEntry[] = []
  let decisions: MemoryEntry[] = []
  let devRules: Array<{ rule: string; sourceId: string }> = []
  try {
    // Overfetch recency-ordered candidates, then let the usefulness
    // ledger reorder before taking the few digest slots: the 3 most
    // PROVEN entries (referenced, fetched, shipped-with) beat the 3 most
    // recently captured. Bounded rerank — recency still leads on ties.
    gotchas = usefulnessService
      .rerank(
        projectId,
        projectMemory.recall(projectId, {
          types: ['gotcha', 'anti-pattern'],
          limit: DIGEST_PER_TYPE * 4,
        })
      )
      .slice(0, DIGEST_PER_TYPE)
    decisions = usefulnessService
      .rerank(
        projectId,
        projectMemory.recall(projectId, { types: ['decision'], limit: DIGEST_PER_TYPE * 4 })
      )
      .slice(0, DIGEST_PER_TYPE)
  } catch {
    return null
  }

  // Developer model: feedback + friction → actionable rules. Pushed here so
  // a cold model (post-update) acts as the developer without MCP pull.
  try {
    const pool = projectMemory.recall(projectId, {
      types: ['feedback', 'improvement-signal'],
      limit: 40,
      dedupeByKey: false,
    })
    devRules = extractDeveloperRules(pool, DIGEST_DEV_RULES)
  } catch {
    devRules = []
  }

  const repeatMiss = findRepeatMissedEntry(
    projectId,
    new Set([...gotchas, ...decisions].map((e) => e.id))
  )
  if (gotchas.length === 0 && decisions.length === 0 && !repeatMiss && devRules.length === 0) {
    return null
  }

  const lines: string[] = ['## What this project already knows', '']
  lines.push(
    '> Carried across sessions and model updates — this survived even if your conversation context did not. Apply these; do not re-derive from source.'
  )
  if (devRules.length > 0) {
    lines.push('', '**How this developer works (act as them):**')
    for (const r of devRules) {
      const short = r.rule.length > 140 ? `${r.rule.slice(0, 139)}…` : r.rule
      lines.push(`- ${short}  \`${r.sourceId}\``)
    }
  }
  if (gotchas.length > 0) {
    lines.push('', '**Traps to avoid:**')
    for (const e of gotchas) lines.push(`- ${digestLine(e)}`)
  }
  if (decisions.length > 0) {
    lines.push('', '**Decisions in force:**')
    for (const e of decisions) lines.push(`- ${digestLine(e)}`)
  }
  if (repeatMiss) {
    lines.push(
      '',
      '**Keeps being missed:**',
      `- ${digestLine(repeatMiss.entry)} — flagged relevant-but-unused ${repeatMiss.count}×. Apply it or supersede it.`
    )
  }
  lines.push(
    '',
    '> Resolve any `mem_id` with `prjct search <id>`. Full developer model: MCP `prjct_developer`.'
  )
  return safeTruncate(lines.join('\n'), DIGEST_MAX_CHARS)
}

/**
 * One digest line: title is usually enough; when the body is longer and
 * carries a distinct second clause, append a short teaser so weak models
 * can apply without a second pull.
 */
function digestLine(e: MemoryEntry): string {
  const title = deriveTitle(e)
  const body = (e.content ?? '').replace(/\s+/g, ' ').trim()
  // If body is essentially the title, skip teaser.
  if (body.length <= title.length + 8) return `${title}  \`${e.id}\``
  // Prefer content after first sentence for the teaser.
  const after = body
    .slice(title.length)
    .replace(/^[\s.:;—-]+/, '')
    .trim()
  if (after.length < 24) return `${title}  \`${e.id}\``
  const teaser = after.length > 90 ? `${after.slice(0, 89)}…` : after
  return `${title} — ${teaser}  \`${e.id}\``
}

/** A memory must be skill-missed at least this often to earn a digest slot. */
const REPEAT_MISS_THRESHOLD = 2

/**
 * The skill-miss feedback loop's read side: the entry most often flagged
 * "relevant but never referenced" across sessions. One slot, ≥2 misses,
 * skipping anything the digest already shows — knowledge that keeps
 * failing to land gets pushed in front of the agent instead of silently
 * accumulating improvement-signal rows. Best-effort: null on any failure.
 */
function findRepeatMissedEntry(
  projectId: string,
  alreadyShown: Set<string>
): { entry: MemoryEntry; count: number } | null {
  try {
    const signals = projectMemory.recall(projectId, {
      types: ['improvement-signal'],
      tags: { kind: 'skill-miss' },
      limit: 50,
      dedupeByKey: false,
    })
    const counts = new Map<string, number>()
    for (const s of signals) {
      const memId = s.tags?.relates
      if (!memId) continue
      counts.set(memId, (counts.get(memId) ?? 0) + 1)
    }
    let topId: string | null = null
    let topCount = 0
    for (const [id, count] of counts) {
      if (count > topCount) {
        topId = id
        topCount = count
      }
    }
    if (!topId || topCount < REPEAT_MISS_THRESHOLD || alreadyShown.has(topId)) return null
    const entry = projectMemory.getById(projectId, topId)
    return entry ? { entry, count: topCount } : null
  } catch {
    return null
  }
}

const SUBAGENT_DIGEST_MAX_CHARS = 500
const SUBAGENT_GOTCHA_COUNT = 2

/**
 * Compact context for a spawned subagent: role, the active work cycle for THIS
 * worktree, and the top preventive traps. Subagents previously received the
 * persona block only and re-investigated facts the main session already knew.
 *
 * SubagentStart's response schema rejects `additionalContext`, so this is
 * emitted as `systemMessage` — outside the cached system-prompt prefix —
 * which is why variable content (the active work cycle) is safe here while the
 * SessionStart persona block must stay byte-identical.
 */
export async function buildSubagentDigest(projectPath: string): Promise<string | null> {
  const config = await configManager.readConfig(projectPath).catch(() => null)
  if (!config?.projectId) return null

  const lines: string[] = ['# prjct: subagent context']
  if (config.persona?.role) lines.push(`Role in this project: ${config.persona.role}`)

  try {
    const { resolveActiveTask } = await import('../services/task-service')
    const task = await resolveActiveTask(config.projectId, projectPath)
    if (task) lines.push(`Active work cycle (this worktree): ${task.description}`)
  } catch {
    // best-effort — a digest without the task is still useful
  }

  try {
    // Same proven-first selection as the session digest (see
    // buildKnowledgeDigest) — subagents do the bulk of the editing, so
    // their 2 trap slots should carry the entries that keep paying off,
    // not just the newest.
    const gotchas = usefulnessService
      .rerank(
        config.projectId,
        projectMemory.recall(config.projectId, {
          types: ['gotcha', 'anti-pattern'],
          limit: SUBAGENT_GOTCHA_COUNT * 4,
        })
      )
      .slice(0, SUBAGENT_GOTCHA_COUNT)
    if (gotchas.length > 0) {
      lines.push('Traps to avoid:')
      for (const e of gotchas) lines.push(`- ${deriveTitle(e)}  \`${e.id}\``)
    }
    // Same repeat-miss slot the session digest has: knowledge flagged
    // relevant-but-unused 2+ times reaches subagents too — they do the
    // bulk of the editing and were blind to it (review follow-up).
    const repeatMiss = findRepeatMissedEntry(config.projectId, new Set(gotchas.map((e) => e.id)))
    if (repeatMiss) {
      lines.push(`Keeps being missed: ${deriveTitle(repeatMiss.entry)}  \`${repeatMiss.entry.id}\``)
    }
  } catch {
    // best-effort
  }

  if (lines.length <= 1) return null
  return safeTruncate(lines.join('\n'), SUBAGENT_DIGEST_MAX_CHARS)
}

function formatPersona(persona: ProjectPersona): string {
  const lines: string[] = []
  lines.push(`## Your role in this project: **${persona.role}**`)
  if (persona.focus) lines.push(`Focus: ${persona.focus}`)
  if (persona.mcps && persona.mcps.length > 0) {
    lines.push(`Available MCPs this project expects: ${persona.mcps.join(', ')}`)
  }
  if (persona.packs && persona.packs.length > 0) {
    lines.push(`Active packs: ${persona.packs.join(', ')}`)
  }
  return lines.join('\n')
}

/**
 * Top-level entry — read stdin, emit JSON, exit.
 * Never throws; hook failures must not break the host session.
 */
export function runSessionStartHook(
  projectPath: string = process.cwd(),
  io?: HookIo
): Promise<void> {
  // Captured by the build closure so afterEmit can reuse it without a
  // second disk read on the hot path that fires on every session start.
  let cachedConfig: LocalConfig | null = null

  return runHook<HookInput>(
    {
      event: 'SessionStart',
      projectPath,
      build: async (input, p) => {
        cachedConfig = await configManager.readConfig(p).catch(() => null)
        // Cold-start sources rebuild context from scratch (no warm cache to
        // bust) and are exactly when grounding matters — a resumed session
        // still holds its context, so it stays persona-only for cache safety.
        const source = input.source ?? 'startup'
        const digest = source === 'startup' || source === 'clear' || source === 'compact'
        return buildSessionContext(p, cachedConfig, { digest })
      },
      afterEmit: async (_input, p) => {
        if (cachedConfig?.projectId) {
          let taskId: string | null = null
          let goal: string | null = _input.source ?? null
          try {
            const { collectActiveTasks } = await import('../services/task-overview')
            const overview = await collectActiveTasks(cachedConfig.projectId, p)
            taskId = overview.current?.id ?? null
            if (overview.current?.description) goal = overview.current.description
          } catch {
            /* best-effort binding */
          }
          recordAgentSessionStart({
            projectId: cachedConfig.projectId,
            sessionId: _input.session_id,
            directory: p,
            taskId,
            goal,
          })
        }

        // Self-heal hooks + global CLAUDE.md when the binary moved past the
        // last sync. Catches machines where postinstall is disabled by
        // security policy. Hot path is one fs read of the stamp file.
        if (!isSyncCurrent(VERSION)) {
          await runSelfHeal(VERSION).catch(() => undefined)
        }

        // M5: opt-in silent auto-update. No-op unless the user has opted
        // in via `prjct config set auto-update on`. Throttled to 1/hour
        // and runs detached so the session never waits.
        try {
          const { maybeAutoUpdate } = await import('../services/auto-updater')
          maybeAutoUpdate(VERSION)
        } catch {
          // never block the session on update mechanics
        }
      },
    },
    io
  )
}
