/**
 * SessionStart hook — injects persona + recent memory as additionalContext.
 *
 * Anti-harness contract: this hook **describes state**, never prescribes
 * action. Output is a short markdown block Claude reads as WHAT, not HOW.
 * No "first do X, then Y" — just "here's who you are, here's what matters
 * right now". Claude decides everything else.
 *
 * Claude Code invokes this via `prjct hook session-start`. Contract:
 *   stdin:  JSON with `source` ("startup" | "resume" | "clear" | "compact")
 *   stdout: JSON { hookSpecificOutput: { hookEventName, additionalContext } }
 *   exit 0: success (even when nothing to inject — emits `{}` instead).
 *
 * We cap injection at MAX_CHARS so a noisy project doesn't blow Claude's
 * context budget on every session start.
 */

import configManager from '../infrastructure/config-manager'
import { formatMemoryMd, type MemoryEntry, projectMemory } from '../memory/project-memory'
import type { ProjectPersona } from '../types/config'

const MAX_CHARS = 2500
const RECENT_MEMORY_LIMIT = 5

interface HookInput {
  source?: 'startup' | 'resume' | 'clear' | 'compact'
}

interface HookOutput {
  hookSpecificOutput?: {
    hookEventName: 'SessionStart'
    additionalContext: string
  }
}

/**
 * Build the additionalContext body for the current project.
 * Exported so tests + other hooks (SubagentStart) can reuse it.
 */
export async function buildSessionContext(projectPath: string): Promise<string | null> {
  const config = await configManager.readConfig(projectPath)
  if (!config?.projectId) return null

  const persona = config.persona

  // Memory recall is best-effort — if the storage layer can't start
  // (e.g. missing native bindings for the host node version) we still
  // want to inject persona. Graceful degradation: no memory section is
  // strictly better than no context at all.
  let entries: MemoryEntry[] = []
  try {
    entries = projectMemory.recall(config.projectId, { limit: RECENT_MEMORY_LIMIT })
  } catch {
    entries = []
  }

  // Nothing useful to inject at all — skip the hook entirely.
  if (!persona && entries.length === 0) return null

  const sections: string[] = []
  sections.push('# prjct: project context')
  sections.push('')

  if (persona) {
    sections.push(formatPersona(persona))
    sections.push('')
  }

  if (entries.length > 0) {
    sections.push('## Recent memory')
    sections.push('')
    sections.push(formatMemoryMd(entries))
    sections.push('')
  }

  sections.push(
    '> Exposed as state, not prescription. Decide whether any of this matters for the current turn.'
  )

  const body = sections.join('\n')
  return body.length > MAX_CHARS ? `${body.slice(0, MAX_CHARS - 20)}\n… [truncated]` : body
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
export async function runSessionStartHook(projectPath: string = process.cwd()): Promise<void> {
  try {
    await readStdinSafe()
    const context = await buildSessionContext(projectPath)
    const output: HookOutput = context
      ? {
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: context,
          },
        }
      : {}
    process.stdout.write(`${JSON.stringify(output)}\n`)
  } catch {
    // Never surface errors to the host — emit empty object, stay out of the way.
    process.stdout.write('{}\n')
  }
}

async function readStdinSafe(): Promise<HookInput> {
  if (process.stdin.isTTY) return {}
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    process.stdin.on('data', (c: Buffer) => chunks.push(c))
    process.stdin.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8').trim()
        if (!raw) return resolve({})
        resolve(JSON.parse(raw) as HookInput)
      } catch {
        resolve({})
      }
    })
    process.stdin.on('error', () => resolve({}))
    // Safety: if stdin never closes (bad caller), timeout after 200ms.
    setTimeout(() => resolve({}), 200)
  })
}
