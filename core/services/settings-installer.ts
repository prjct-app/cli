/**
 * Claude Code settings installer.
 *
 * Merges prjct's hook entries into `~/.claude/settings.json` without
 * clobbering user keys or hooks installed by other tools. Every entry we
 * write is tagged with `_prjctManaged: true` so `uninstall` can strip
 * them cleanly.
 *
 * Why a separate file instead of a plugin manifest: Claude Code's plugin
 * system is still rolling out across hosts (Code / Design / Cowork);
 * settings.json is the universal fallback that works everywhere today.
 * When plugin manifests stabilize, we flip to that and delete this.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/**
 * Resolve home per call. Prefer `process.env.HOME` so tests can point
 * at a temp dir — `os.homedir()` on macOS/Linux ignores HOME and reads
 * the uid-mapped home, which breaks isolation. In normal CLI runs
 * `process.env.HOME` is set, so `os.homedir()` is a last-resort fallback.
 */
function settingsPath(): string {
  const home = process.env.HOME || os.homedir()
  return path.join(home, '.claude', 'settings.json')
}

const MANAGED_MARKER = '_prjctManaged'

/** Every hook we install — keep in one place so install/uninstall agree. */
export const PRJCT_HOOKS = [
  { event: 'SessionStart', matcher: '', subcommand: 'session-start' },
  { event: 'UserPromptSubmit', matcher: '', subcommand: 'prompt' },
  {
    event: 'PreToolUse',
    matcher: 'Bash',
    subcommand: 'pre-commit',
    ifClause: 'Bash(git commit *)',
  },
  { event: 'PostToolUse', matcher: 'Edit|Write', subcommand: 'post-edit' },
  { event: 'Stop', matcher: '', subcommand: 'stop' },
  { event: 'SubagentStart', matcher: '', subcommand: 'subagent-start' },
  { event: 'CwdChanged', matcher: '', subcommand: 'cwd-changed' },
] as const

type HookSpec = (typeof PRJCT_HOOKS)[number]

interface HookEntry {
  type: 'command'
  command: string
  if?: string
  timeout?: number
  [MANAGED_MARKER]?: true
}

interface HookMatcher {
  matcher?: string
  hooks: HookEntry[]
}

interface SettingsFile {
  hooks?: Record<string, HookMatcher[]>
  [key: string]: unknown
}

interface InstallResult {
  settingsPath: string
  hooksWritten: number
  alreadyPresent: number
}

interface UninstallResult {
  settingsPath: string
  hooksRemoved: number
}

async function readSettings(): Promise<SettingsFile> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') return parsed as SettingsFile
    return {}
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw err
  }
}

async function writeSettings(settings: SettingsFile): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true })
  await fs.writeFile(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`, 'utf-8')
}

/**
 * Shell command for a hook — delegates to the installed `prjct` binary.
 * We resolve via PATH so the hook survives node/bun upgrades; if the
 * user moves prjct to a non-PATH location they can override via env.
 */
function hookCommand(subcommand: string): string {
  const bin = process.env.PRJCT_BIN ?? 'prjct'
  return `${bin} hook ${subcommand}`
}

function isPrjctHook(entry: HookEntry): boolean {
  return entry[MANAGED_MARKER] === true
}

function hookEntryFor(spec: HookSpec): HookEntry {
  const entry: HookEntry = {
    type: 'command',
    command: hookCommand(spec.subcommand),
    [MANAGED_MARKER]: true,
  }
  if ('ifClause' in spec && spec.ifClause) entry.if = spec.ifClause
  return entry
}

/**
 * Install prjct's hook stack. Idempotent — existing prjct entries are
 * refreshed (command + if clause), never duplicated. Non-prjct hooks
 * stay untouched.
 */
export async function install(): Promise<InstallResult> {
  const settings = await readSettings()
  const hooks: Record<string, HookMatcher[]> = settings.hooks ?? {}

  let hooksWritten = 0
  let alreadyPresent = 0

  for (const spec of PRJCT_HOOKS) {
    const eventEntries: HookMatcher[] = hooks[spec.event] ?? []
    const desiredCommand = hookCommand(spec.subcommand)

    // Find an existing matcher block with the same matcher, or add one.
    let block = eventEntries.find((b) => (b.matcher ?? '') === spec.matcher)
    if (!block) {
      block = { matcher: spec.matcher, hooks: [] }
      eventEntries.push(block)
    }

    const existing = block.hooks.find((h) => isPrjctHook(h))
    if (existing) {
      // Refresh command + if clause in case the binary path or matcher changed.
      const refreshed = hookEntryFor(spec)
      if (existing.command === refreshed.command && existing.if === refreshed.if) {
        alreadyPresent++
      } else {
        existing.command = refreshed.command
        existing.if = refreshed.if
        hooksWritten++
      }
    } else {
      block.hooks.push(hookEntryFor(spec))
      hooksWritten++
    }

    hooks[spec.event] = eventEntries
    // Silence unused var lint on desiredCommand (we read it via hookEntryFor).
    void desiredCommand
  }

  settings.hooks = hooks
  await writeSettings(settings)
  return { settingsPath: settingsPath(), hooksWritten, alreadyPresent }
}

/**
 * Remove every hook entry tagged as prjct-managed. Empty matcher blocks
 * and empty events are pruned so the file stays clean. User hooks
 * under the same events survive.
 */
export async function uninstall(): Promise<UninstallResult> {
  const settings = await readSettings()
  if (!settings.hooks) return { settingsPath: settingsPath(), hooksRemoved: 0 }

  let hooksRemoved = 0
  for (const [event, blocks] of Object.entries(settings.hooks)) {
    const cleanedBlocks: HookMatcher[] = []
    for (const block of blocks) {
      const remaining = block.hooks.filter((h) => {
        if (isPrjctHook(h)) {
          hooksRemoved++
          return false
        }
        return true
      })
      if (remaining.length > 0) cleanedBlocks.push({ ...block, hooks: remaining })
    }
    if (cleanedBlocks.length > 0) settings.hooks[event] = cleanedBlocks
    else delete settings.hooks[event]
  }

  if (Object.keys(settings.hooks).length === 0) delete settings.hooks

  await writeSettings(settings)
  return { settingsPath: settingsPath(), hooksRemoved }
}

/** Introspection for `prjct doctor` — returns count currently installed. */
export async function status(): Promise<{ installed: number; expected: number }> {
  const settings = await readSettings()
  const hooks = settings.hooks ?? {}
  let installed = 0
  for (const blocks of Object.values(hooks)) {
    for (const block of blocks) {
      for (const h of block.hooks) if (isPrjctHook(h)) installed++
    }
  }
  return { installed, expected: PRJCT_HOOKS.length }
}
