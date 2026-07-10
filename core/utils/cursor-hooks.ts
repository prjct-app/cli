/**
 * Cursor hooks installer — maps PRJCT_HOOKS into `~/.cursor/hooks.json`.
 *
 * Cursor uses camelCase event names and a flat handler list (not Claude's
 * matcher-group nesting):
 *
 *   { "version": 1, "hooks": { "preToolUse": [{ "command", "matcher?", "timeout?" }] } }
 *
 * Locations Cursor loads: project `.cursor/hooks.json`, user `~/.cursor/hooks.json`.
 * We write the **user** path so install is global and clean-repo stays clean
 * (no automatic project writes). Grok Build also reads `.cursor/hooks.json`.
 *
 * Docs/community (2026): sessionStart, preToolUse, postToolUse, stop;
 * matchers like Write|StrReplace; timeout in seconds.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { resolveUserPath } from '../infrastructure/user-home'
import { PRJCT_HOOKS } from '../services/settings-installer'

const MANAGED_MARKER = '_prjctManaged' as const

export function getCursorHooksJsonPath(): string {
  if (process.env.PRJCT_TEST_MODE === '1') {
    return path.join(resolveUserPath('.prjct-tests'), 'cursor', 'hooks.json')
  }
  return resolveUserPath('.cursor', 'hooks.json')
}

interface CursorHookHandler {
  command: string
  matcher?: string
  timeout?: number
  /** Optional; ignored by Cursor if unknown — used for install/uninstall identity. */
  [MANAGED_MARKER]?: true
  name?: string
}

interface CursorHooksFile {
  version?: number
  hooks?: Record<string, CursorHookHandler[]>
  [key: string]: unknown
}

export interface CursorHooksInstallResult {
  hooksPath: string
  hooksWritten: number
  alreadyPresent: number
  hooksPruned: number
}

export interface CursorHooksUninstallResult {
  hooksPath: string
  hooksRemoved: number
}

interface CursorHookMap {
  cursorEvent: string
  matcher?: string
  subcommand: string
  name: string
}

/**
 * Claude PRJCT_HOOKS → Cursor camelCase events + tool matchers.
 * Skip events Cursor has no documented equivalent for.
 */
export function cursorHookMaps(): CursorHookMap[] {
  const maps: CursorHookMap[] = []
  for (const spec of PRJCT_HOOKS) {
    if (spec.event === 'SessionStart') {
      maps.push({
        cursorEvent: 'sessionStart',
        subcommand: spec.subcommand,
        name: `prjct-${spec.subcommand}`,
      })
    } else if (spec.event === 'UserPromptSubmit') {
      // Community / schema: beforeSubmitPrompt (when present) or userPromptSubmit
      maps.push({
        cursorEvent: 'beforeSubmitPrompt',
        subcommand: spec.subcommand,
        name: `prjct-${spec.subcommand}`,
      })
    } else if (spec.event === 'PreToolUse' && spec.matcher === 'Bash') {
      maps.push({
        cursorEvent: 'preToolUse',
        matcher: 'Shell|Bash',
        subcommand: spec.subcommand,
        // Disambiguate when the same subcommand installs on shell + write matchers
        name:
          spec.subcommand === 'pre-secrets'
            ? 'prjct-pre-secrets-shell'
            : `prjct-${spec.subcommand}`,
      })
    } else if (spec.event === 'PreToolUse' && spec.matcher === 'Edit|Write') {
      maps.push({
        cursorEvent: 'preToolUse',
        matcher: 'Write|StrReplace|Edit',
        subcommand: spec.subcommand,
        name:
          spec.subcommand === 'pre-secrets'
            ? 'prjct-pre-secrets-write'
            : `prjct-${spec.subcommand}`,
      })
    } else if (spec.event === 'PostToolUse' && spec.matcher === 'Edit|Write') {
      maps.push({
        cursorEvent: 'postToolUse',
        matcher: 'Write|StrReplace|Edit',
        subcommand: spec.subcommand,
        name: `prjct-${spec.subcommand}`,
      })
    } else if (spec.event === 'Stop') {
      maps.push({
        cursorEvent: 'stop',
        subcommand: spec.subcommand,
        name: `prjct-${spec.subcommand}`,
      })
    } else if (spec.event === 'SubagentStart') {
      maps.push({
        cursorEvent: 'subagentStart',
        subcommand: spec.subcommand,
        name: `prjct-${spec.subcommand}`,
      })
    } else if (spec.event === 'SubagentStop') {
      maps.push({
        cursorEvent: 'subagentStop',
        subcommand: spec.subcommand,
        name: `prjct-${spec.subcommand}`,
      })
    }
    // Notification / CwdChanged — no stable Cursor equivalent
  }
  return maps
}

function hookCommand(subcommand: string): string {
  const bin = process.env.PRJCT_BIN ?? 'prjct'
  return `command -v ${bin} >/dev/null 2>&1 && PRJCT_HOOK_HOST=cursor ${bin} hook ${subcommand} || exit 0`
}

function isPrjctHandler(h: CursorHookHandler): boolean {
  return (
    h[MANAGED_MARKER] === true ||
    (h.name?.startsWith('prjct-') ?? false) ||
    /PRJCT_HOOK_HOST=cursor/.test(h.command)
  )
}

function isLegacyPrjctHandler(h: CursorHookHandler): boolean {
  if (h[MANAGED_MARKER] === true) return false
  return /(^|\/|\s)prjct\s+hook\s+\S+/.test(h.command ?? '')
}

async function readHooksFile(hooksPath: string): Promise<CursorHooksFile> {
  try {
    const raw = await fs.readFile(hooksPath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') return parsed as CursorHooksFile
    return { version: 1 }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1 }
    throw err
  }
}

async function writeHooksFile(hooksPath: string, data: CursorHooksFile): Promise<void> {
  await fs.mkdir(path.dirname(hooksPath), { recursive: true })
  data.version = data.version ?? 1
  await fs.writeFile(hooksPath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
}

function handlerFor(map: CursorHookMap): CursorHookHandler {
  const h: CursorHookHandler = {
    command: hookCommand(map.subcommand),
    timeout: 30,
    name: map.name,
    [MANAGED_MARKER]: true,
  }
  if (map.matcher) h.matcher = map.matcher
  return h
}

function pruneOrphans(hooks: Record<string, CursorHookHandler[]>): number {
  const valid = new Set(cursorHookMaps().map((m) => m.name))
  let pruned = 0
  for (const event of Object.keys(hooks)) {
    hooks[event] = (hooks[event] ?? []).filter((h) => {
      if (!isPrjctHandler(h) && !isLegacyPrjctHandler(h)) return true
      if (h.name && valid.has(h.name)) return true
      pruned++
      return false
    })
    if (hooks[event].length === 0) delete hooks[event]
  }
  return pruned
}

/**
 * Idempotently install prjct hooks into user-level ~/.cursor/hooks.json.
 */
export async function installCursorHooks(
  hooksPath = getCursorHooksJsonPath()
): Promise<CursorHooksInstallResult> {
  const file = await readHooksFile(hooksPath)
  const hooks: Record<string, CursorHookHandler[]> = { ...(file.hooks ?? {}) }
  let hooksWritten = 0
  let alreadyPresent = 0

  for (const map of cursorHookMaps()) {
    const list = hooks[map.cursorEvent] ?? []
    // Drop legacy unmarked prjct entries
    const cleaned = list.filter((h) => !(isLegacyPrjctHandler(h) && !isPrjctHandler(h)))
    const desired = handlerFor(map)
    const idx = cleaned.findIndex(
      (h) => isPrjctHandler(h) && (h.name === map.name || h.command.includes(map.subcommand))
    )
    if (idx >= 0) {
      const existing = cleaned[idx]
      if (
        existing.command === desired.command &&
        existing.matcher === desired.matcher &&
        existing.timeout === desired.timeout
      ) {
        alreadyPresent++
      } else {
        cleaned[idx] = { ...existing, ...desired }
        hooksWritten++
      }
    } else {
      cleaned.push(desired)
      hooksWritten++
    }
    hooks[map.cursorEvent] = cleaned
  }

  const hooksPruned = pruneOrphans(hooks)
  file.version = 1
  file.hooks = hooks
  await writeHooksFile(hooksPath, file)
  return { hooksPath, hooksWritten, alreadyPresent, hooksPruned }
}

export async function uninstallCursorHooks(
  hooksPath = getCursorHooksJsonPath()
): Promise<CursorHooksUninstallResult> {
  const file = await readHooksFile(hooksPath)
  if (!file.hooks) return { hooksPath, hooksRemoved: 0 }

  let hooksRemoved = 0
  for (const event of Object.keys(file.hooks)) {
    const before = file.hooks[event]?.length ?? 0
    file.hooks[event] = (file.hooks[event] ?? []).filter((h) => {
      if (isPrjctHandler(h) || isLegacyPrjctHandler(h)) {
        hooksRemoved++
        return false
      }
      return true
    })
    if (file.hooks[event].length === 0) delete file.hooks[event]
    void before
  }
  if (Object.keys(file.hooks).length === 0) delete file.hooks
  await writeHooksFile(hooksPath, file)
  return { hooksPath, hooksRemoved }
}

export async function cursorHooksStatus(hooksPath = getCursorHooksJsonPath()): Promise<{
  installed: number
  expected: number
  path: string
}> {
  const file = await readHooksFile(hooksPath)
  let installed = 0
  for (const list of Object.values(file.hooks ?? {})) {
    for (const h of list) {
      if (isPrjctHandler(h) || isLegacyPrjctHandler(h)) installed++
    }
  }
  return { installed, expected: cursorHookMaps().length, path: hooksPath }
}
