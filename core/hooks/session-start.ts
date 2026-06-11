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
 * `prjct remember`, `prjct capture`, or `prjct ship` between sessions
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
import { usefulnessService } from '../services/usefulness'
import { regenerateWikiDeferred } from '../services/wiki-generator'
import type { LocalConfig, ProjectPersona } from '../types/config'
import { VERSION } from '../utils/version'
import { type HookIo, runHook } from './_runner'
import { safeTruncate } from './_shared'

interface HookInput {
  source?: 'startup' | 'resume' | 'clear' | 'compact'
}

interface SessionContextOptions {
  /**
   * Append the project-knowledge digest (top gotchas + decisions + developer
   * profile pointer). OFF by default — see the cache-stability note below.
   * Only the cold-start sources (`startup`/`clear`/`compact`) pass `true`.
   */
  digest?: boolean
}

const DIGEST_MAX_CHARS = 1400
const DIGEST_PER_TYPE = 3

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
 * and the vault is the only thing that survived the update. The mid-session
 * reusers call this with `digest` unset → persona-only, byte-identical.
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

  // Nothing to say (no persona declared AND no knowledge yet) → stay silent.
  if (!persona && !digest) return null

  const sections: string[] = ['# prjct: project context', '']
  if (persona) {
    sections.push(
      formatPersona(persona),
      '',
      '> Exposed as state, not prescription. Decide whether any of this matters for the current turn.',
      '> For recall, run `prjct context memory [topic]` (per-turn topical memory is already injected by the prompt hook).'
    )
  }
  if (digest) {
    if (persona) sections.push('')
    sections.push(digest)
  }
  return sections.join('\n')
}

/**
 * Compact, high-signal recall of what the project already knows — the
 * cross-model-update grounding. Top preventive traps + recent decisions +
 * a pointer to the synthesized developer profile. Recency-ranked, tightly
 * truncated so it never bloats the cold-start context.
 */
function buildKnowledgeDigest(projectId: string): string | null {
  let gotchas: MemoryEntry[] = []
  let decisions: MemoryEntry[] = []
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
  const repeatMiss = findRepeatMissedEntry(
    projectId,
    new Set([...gotchas, ...decisions].map((e) => e.id))
  )
  if (gotchas.length === 0 && decisions.length === 0 && !repeatMiss) return null

  const lines: string[] = ['## What this project already knows', '']
  lines.push(
    '> Carried across sessions and model updates — this survived even if your conversation context did not.'
  )
  if (gotchas.length > 0) {
    lines.push('', '**Traps to avoid:**')
    for (const e of gotchas) lines.push(`- ${deriveTitle(e)}  \`${e.id}\``)
  }
  if (decisions.length > 0) {
    lines.push('', '**Decisions in force:**')
    for (const e of decisions) lines.push(`- ${deriveTitle(e)}  \`${e.id}\``)
  }
  if (repeatMiss) {
    lines.push(
      '',
      '**Keeps being missed:**',
      `- ${deriveTitle(repeatMiss.entry)}  \`${repeatMiss.entry.id}\` — flagged relevant-but-unused ${repeatMiss.count}×. Apply it or supersede it.`
    )
  }
  lines.push(
    '',
    '> Resolve any `mem_id` with `prjct search <id>`. Who the developer is lives in `developer.md` in the vault.'
  )
  return safeTruncate(lines.join('\n'), DIGEST_MAX_CHARS)
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
 * Compact context for a spawned subagent: role, the active task for THIS
 * worktree, and the top preventive traps. Subagents previously received the
 * persona block only and re-investigated facts the main session already knew.
 *
 * SubagentStart's response schema rejects `additionalContext`, so this is
 * emitted as `systemMessage` — outside the cached system-prompt prefix —
 * which is why variable content (the active task) is safe here while the
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
    if (task) lines.push(`Active task (this worktree): ${task.description}`)
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
        // Refresh the Obsidian vault from DB so the files Claude may Read
        // reflect current project state. Best-effort; errors are swallowed.
        if (cachedConfig?.projectId) {
          await regenerateWikiDeferred(p, cachedConfig.projectId).catch(() => undefined)
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
