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
import { deriveTitle, type MemoryEntry, projectMemory } from '../memory/project-memory'
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
    gotchas = projectMemory.recall(projectId, {
      types: ['gotcha', 'anti-pattern'],
      limit: DIGEST_PER_TYPE,
    })
    decisions = projectMemory.recall(projectId, { types: ['decision'], limit: DIGEST_PER_TYPE })
  } catch {
    return null
  }
  if (gotchas.length === 0 && decisions.length === 0) return null

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
  lines.push(
    '',
    '> Resolve any `mem_id` with `prjct search <id>`. Who the developer is lives in `developer.md` in the vault.'
  )
  return safeTruncate(lines.join('\n'), DIGEST_MAX_CHARS)
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
