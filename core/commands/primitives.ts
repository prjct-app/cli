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
import { scanForSecrets } from '../memory/secret-scanner'
import type { TaskType } from '../schemas/state'
import { memoryService } from '../services/memory-service'
import { stateStorage } from '../storage/state-storage'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'
import { requireActiveTask, requireProjectId } from './guards'

const TASK_TYPE_VALUES: readonly TaskType[] = ['feature', 'bug', 'improvement', 'chore']

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
    options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const pid = await requireProjectId(projectPath)
      if (!pid.ok) return pid.result

      // Resume-intent bypasses the active-task guard: when the current task
      // is paused, there's no `currentTask` — we need to promote a paused
      // one before we can check anything else.
      const resumeIntent =
        value !== null &&
        ['active', 'resume', 'in_progress', 'working'].includes(value.toLowerCase())
      if (resumeIntent) {
        const current = await stateStorage.getCurrentTask(pid.value)
        if (!current) {
          const resumed = await stateStorage.resumeTask(pid.value)
          if (resumed) {
            await memoryService.log(projectPath, STATUS_CHANGE_ACTION, {
              taskId: resumed.id,
              from: 'paused',
              to: value,
            })
            const msg = `status → ${value}`
            if (options.md) console.log(`✓ ${msg}`)
            else out.done(msg)
            return { success: true, taskId: resumed.id, status: value }
          }
        }
      }

      // No-arg `status` should still be informative when the task is
      // paused (no currentTask). Show the paused task rather than a bogus
      // "no active task" — the task exists, it just isn't the focus.
      if (!value) {
        const current = await stateStorage.getCurrentTask(pid.value)
        if (!current) {
          const paused = await stateStorage.getPausedTasks(pid.value)
          if (paused.length > 0) {
            const t = paused[0]
            const line = `Task: ${t.id}  |  Type: ${t.type ?? 'unset'}  |  Status: paused`
            if (options.md) console.log(line)
            else out.info(line)
            return { success: true, taskId: t.id, status: 'paused' }
          }
        }
      }

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

      // Drive the real workflow state machine so state.json and the audit
      // log agree. Without this, `status paused` flips the audit trail but
      // leaves state.currentTask.status='in_progress', which later blocks
      // `prjct task` with a bogus "cannot transition from working".
      const normalized = value.toLowerCase()
      try {
        if (normalized === 'done' || normalized === 'completed') {
          await stateStorage.completeTask(pid.value)
        } else if (normalized === 'paused' || normalized === 'pause') {
          await stateStorage.pauseTask(pid.value)
        } else if (
          normalized === 'active' ||
          normalized === 'resume' ||
          normalized === 'in_progress' ||
          normalized === 'working'
        ) {
          // Only resume if there's no active task; otherwise it's a no-op.
          const current = await stateStorage.getCurrentTask(pid.value)
          if (!current) await stateStorage.resumeTask(pid.value)
        }
      } catch {
        // State machine rejected a redundant transition (e.g. `done` on an
        // already-completed task). The audit log still captures intent.
      }

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
    options: MdOption = {}
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
      // `.prjct/wiki/_generated/` see the new entry. In daemon mode this
      // returns before the regen runs; in raw CLI mode it awaits, since
      // process.exit would drop the promise. The incremental manifest
      // keeps the cost near-zero for the typical 1-entry delta.
      const { regenerateWikiDeferred } = await import('../services/wiki-generator')
      await regenerateWikiDeferred(projectPath, pid.value)

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

  // Types are freeform — base types (fact, decision, learning, insight,
  // okr, person, ...) are the common vocabulary; custom ones like
  // `recipe` or `workout` persist without ceremony. Just disallow empty
  // and obvious garbage.
  const typeStr = trimmed.slice(0, firstSpace).toLowerCase().trim()
  if (!typeStr || !/^[a-z][a-z0-9-]*$/.test(typeStr)) {
    return {
      ok: false,
      error: `invalid type '${typeStr}'. Lowercase letters + dashes only. Base types: ${MEMORY_TYPES.join(', ')}`,
    }
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
