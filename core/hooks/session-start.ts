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
import { regenerateWikiDeferred } from '../services/wiki-generator'
import type { LocalConfig, ProjectPersona } from '../types/config'
import { VERSION } from '../utils/version'
import { runHook } from './_runner'

interface HookInput {
  source?: 'startup' | 'resume' | 'clear' | 'compact'
}

/**
 * Build the additionalContext body for the current project.
 *
 * `preloadedConfig` lets the caller skip a duplicate disk read — the
 * hook entry point reads config once and passes it down. Tests can
 * keep calling this with just `projectPath` and we'll read it ourselves.
 */
export async function buildSessionContext(
  projectPath: string,
  preloadedConfig?: LocalConfig | null
): Promise<string | null> {
  const config = preloadedConfig ?? (await configManager.readConfig(projectPath))
  if (!config?.projectId) return null

  const persona = config.persona
  if (!persona) return null

  return [
    '# prjct: project context',
    '',
    formatPersona(persona),
    '',
    '> Exposed as state, not prescription. Decide whether any of this matters for the current turn.',
    '> For recall, run `prjct context memory [topic]` (per-turn topical memory is already injected by the prompt hook).',
  ].join('\n')
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
export function runSessionStartHook(projectPath: string = process.cwd()): Promise<void> {
  // Captured by the build closure so afterEmit can reuse it without a
  // second disk read on the hot path that fires on every session start.
  let cachedConfig: LocalConfig | null = null

  return runHook<HookInput>({
    event: 'SessionStart',
    projectPath,
    build: async (_input, p) => {
      cachedConfig = await configManager.readConfig(p).catch(() => null)
      return buildSessionContext(p, cachedConfig)
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
  })
}
