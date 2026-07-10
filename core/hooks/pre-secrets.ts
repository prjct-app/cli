/**
 * PreToolUse credential guard — security MUST.
 *
 * Scans tool arguments (Bash command, Edit/Write contents, Gemini
 * run_shell_command / write_file args, …) for secret material before the
 * tool runs. On a hit: DENY the tool call so credentials never leave the
 * machine via curl, git commit, file write, or similar.
 *
 * Design constraints (from multi-runtime reality):
 *  - No `$PPID` / host-only env. Gemini sanitizes hook env and will refuse
 *    to execute hooks that require vars it does not set ("required env
 *    var(s) not set: ${PPID}"). Security MUSTS must not depend on that.
 *  - Portable pure regex via `secret-scanner` (no FS / SQLite).
 *  - Fail-soft decide: any throw ⇒ allow (never brick the session on a bug).
 *  - Only PreToolUse with explicit `decide` may deny (harness contract).
 */

import { scanHookToolInput } from '../utils/secret-scanner'
import { type HookIo, runHook } from './_runner'

interface HookInput {
  tool_name?: string
  tool_input?: unknown
  toolInput?: unknown
  command?: string
  content?: string
  [key: string]: unknown
}

function decideSecrets(input: HookInput): { deny: string } | null {
  const hits = scanHookToolInput(input)
  if (hits.length === 0) return null
  const list = hits.join(', ')
  return {
    deny:
      `⛔ prjct credential guard: tool input matches secret pattern(s): ${list}. ` +
      `Refusing to run this tool so credentials are not exposed. ` +
      `Remove the secret from the command/content and retry. ` +
      `(This MUST runs on every host — no PPID / host-env dependency.)`,
  }
}

export function runPreSecretsHook(projectPath: string = process.cwd(), io?: HookIo): Promise<void> {
  return runHook<HookInput>(
    {
      event: 'PreToolUse',
      projectPath,
      // decide only — no additionalContext noise when clean
      decide: async (input) => {
        try {
          return decideSecrets(input)
        } catch {
          return null // fail open on scanner bugs
        }
      },
    },
    io
  )
}

/** Pure export for unit tests. */
export const _internal = { decideSecrets }
