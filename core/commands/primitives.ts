/**
 * v2 Primitives: status, tag, remember
 *
 * Minimal, composable verbs that let Claude drive work without the CLI
 * imposing opinions.
 *
 * - status: inline status change on active task (escape hatch, Linear-style)
 * - tag: Claude attaches key:value tags to active task (e.g. type:bug)
 * - remember: Claude saves project memory entries (fact, decision, learning…)
 */

import { STATUS_CHANGE_ACTION } from '../memory/events'
import { MEMORY_TYPES, type MemoryType, projectMemory } from '../memory/project-memory'
import type { TaskType } from '../schemas/state'
import { memoryService } from '../services/memory-service'
import { stateStorage } from '../storage/state-storage'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'
import { requireActiveTask, requireProjectId } from './guards'

const TASK_TYPE_VALUES: readonly TaskType[] = ['feature', 'bug', 'improvement', 'chore']

/**
 * Secret patterns we refuse to persist as-is. Conservative list — any hit
 * triggers a warning and the user has to re-run with `--force` if they
 * really want to record it. Better a false positive than a committed key.
 */
const SECRET_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'sk-… token', re: /\bsk-[A-Za-z0-9_-]{16,}/ },
  { name: 'GitHub PAT', re: /\bghp_[A-Za-z0-9]{30,}/ },
  { name: 'GitHub server PAT', re: /\bghs_[A-Za-z0-9]{30,}/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Slack token', re: /\bxox[abps]-[A-Za-z0-9-]{10,}/ },
  {
    name: 'bearer JWT-ish',
    re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  },
]

function scanForSecrets(text: string): string[] {
  const hits: string[] = []
  for (const { name, re } of SECRET_PATTERNS) if (re.test(text)) hits.push(name)
  return hits
}

export class PrimitiveCommands extends PrjctCommandsBase {
  /**
   * /p:status <value>
   *
   * Escape hatch for changing the active task's status. Workflows are the
   * primary mechanism; this exists for quick overrides.
   */
  async status(
    value: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const pid = await requireProjectId(projectPath)
      if (!pid.ok) return pid.result

      const task = await requireActiveTask(pid.value, options)
      if (!task.ok) return task.result

      const active = task.value
      // Recover the last status transition (if any) for this task so the
      // no-args `prjct status` reflects reality, not the task `type` tag.
      const lastStatus = await readLastStatus(pid.value, active.id)

      if (!value) {
        const line = `Task: ${active.id}  |  Type: ${active.type ?? 'unset'}  |  Status: ${lastStatus ?? 'active'}`
        if (options.md) console.log(line)
        else out.info(line)
        return { success: true, taskId: active.id, status: lastStatus ?? 'active' }
      }

      await memoryService.log(projectPath, STATUS_CHANGE_ACTION, {
        taskId: active.id,
        from: lastStatus ?? null,
        to: value,
      })

      const msg = `status → ${value}`
      if (options.md) console.log(`✓ ${msg}`)
      else out.done(msg)
      return { success: true, taskId: active.id, status: value }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }

  /**
   * /p:tag <k:v> [<k:v>...]
   *
   * Attach tags to the active task. `type:<taskType>` is promoted to the
   * task column; everything else is stored as a memory event.
   */
  async tag(
    args: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const pid = await requireProjectId(projectPath)
      if (!pid.ok) return pid.result

      const task = await requireActiveTask(pid.value, options)
      if (!task.ok) return task.result

      if (!args) {
        out.info('Usage: prjct tag <key:value> [<key:value>...]')
        return { success: false, error: 'No tags provided' }
      }

      const tags = parseTagPairs(args)
      if (Object.keys(tags).length === 0) {
        out.fail('no valid k:v pairs (expected `key:value`)')
        return { success: false, error: 'Invalid tag format' }
      }

      const typeTag = tags.type
      if (typeTag && (TASK_TYPE_VALUES as readonly string[]).includes(typeTag)) {
        await stateStorage.updateCurrentTask(pid.value, { type: typeTag as TaskType })
      }

      await memoryService.log(projectPath, 'task.tagged', {
        taskId: task.value.id,
        tags,
      })

      const pretty = Object.entries(tags)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
      if (options.md) console.log(`✓ tagged ${pretty}`)
      else out.done(`tagged ${pretty}`)
      return { success: true, taskId: task.value.id, tags }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }

  /**
   * /p:remember <type> "<content>" [--tags k:v,...] [--force]
   *
   * Claude captures a project memory entry. Refuses to store content that
   * looks like a secret unless `--force` is passed.
   */
  async remember(
    args: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean; tags?: string; force?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      if (!args) {
        out.info(
          `Usage: prjct remember <type> "<content>" [--tags k:v,...]\nTypes: ${MEMORY_TYPES.join(' | ')}`
        )
        return { success: false, error: 'Missing args' }
      }

      const parsed = parseRememberArgs(args)
      if (!parsed.ok) {
        out.fail(parsed.error)
        return { success: false, error: parsed.error }
      }
      const { type, content } = parsed

      const secretHits = scanForSecrets(content)
      if (secretHits.length > 0 && !options.force) {
        const hit = secretHits.join(', ')
        out.fail(
          `refusing to store memory that looks like a secret (${hit}). Re-run with --force if intentional.`
        )
        return { success: false, error: 'Secret-like content detected' }
      }

      const tags = parseFlagTags(options.tags)

      const pid = await requireProjectId(projectPath)
      if (!pid.ok) return pid.result

      // `remember` works even without an active task — you might be
      // capturing a fact before kicking off work. Just record without
      // source in that case.
      const active = await stateStorage.getCurrentTask(pid.value)

      await projectMemory.remember(projectPath, {
        type,
        content,
        tags,
        source: active?.id,
      })

      // Keep the agent-crawlable wiki in sync so subagents reading
      // `.prjct/wiki/_generated/` see the new entry without waiting for
      // the next ship. Best-effort — a wiki failure must not break the
      // remember call.
      try {
        const { generateWiki } = await import('../services/wiki-generator')
        await generateWiki(projectPath, pid.value)
      } catch {
        // Non-critical
      }

      if (options.md) console.log(`✓ remembered ${type}: ${content}`)
      else out.done(`remembered ${type}`)

      return { success: true, type, content, tags }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }
}

// =============================================================================
// Helpers (unexported)
// =============================================================================

function parseTagPairs(args: string): Record<string, string> {
  const pairs = args
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair): [string, string] | null => {
      const idx = pair.indexOf(':')
      if (idx <= 0) return null
      return [pair.slice(0, idx), pair.slice(idx + 1)]
    })
    .filter((p): p is [string, string] => p !== null)
  return Object.fromEntries(pairs)
}

function parseFlagTags(raw: string | undefined): Record<string, string> {
  if (!raw) return {}
  const tags: Record<string, string> = {}
  for (const token of raw.split(',')) {
    const pair = token.trim()
    const idx = pair.indexOf(':')
    if (idx > 0) tags[pair.slice(0, idx)] = pair.slice(idx + 1)
  }
  return tags
}

type ParsedRemember = { ok: true; type: MemoryType; content: string } | { ok: false; error: string }

function parseRememberArgs(args: string): ParsedRemember {
  const trimmed = args.trim()
  const firstSpace = trimmed.search(/\s/)
  if (firstSpace <= 0) return { ok: false, error: 'expected `<type> "<content>"`' }

  const typeStr = trimmed.slice(0, firstSpace).toLowerCase()
  if (!(MEMORY_TYPES as readonly string[]).includes(typeStr)) {
    return { ok: false, error: `unknown type '${typeStr}'. Valid: ${MEMORY_TYPES.join(' | ')}` }
  }
  const type = typeStr as MemoryType

  let content = trimmed.slice(firstSpace + 1).trim()
  if (
    (content.startsWith('"') && content.endsWith('"')) ||
    (content.startsWith("'") && content.endsWith("'"))
  ) {
    content = content.slice(1, -1)
  }
  if (!content) return { ok: false, error: 'content is required' }
  return { ok: true, type, content }
}

/**
 * Read the most recent status transition for a task out of the memory
 * event log. Events outlive the task column (which only holds `type`) so
 * we can show a real status in `prjct status` without a schema change.
 */
async function readLastStatus(projectId: string, taskId: string): Promise<string | null> {
  try {
    const { default: prjctDb } = await import('../storage/database')
    type Row = { data: string }
    const rows = prjctDb.query<Row>(
      projectId,
      'SELECT data FROM events WHERE type = ? ORDER BY id DESC LIMIT 10',
      `memory.${STATUS_CHANGE_ACTION}`
    )
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.data) as { taskId?: string; to?: string }
        if (parsed.taskId === taskId && parsed.to) return parsed.to
      } catch {
        // ignore malformed row
      }
    }
  } catch {
    // non-critical
  }
  return null
}
