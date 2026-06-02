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

import { MEMORY_TYPES, type MemoryType, projectMemory } from '../memory/project-memory'
import type { TaskType } from '../schemas/state'
import { memoryService } from '../services/memory-service'
import { readLastStatus, resolveActiveTask, setTaskStatus } from '../services/task-service'
import { stateStorage } from '../storage/state-storage'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { failHard } from '../utils/md-aware'
import out from '../utils/output'
import { scanForPromptInjection } from '../utils/prompt-injection'
import { scanForSecrets } from '../utils/secret-scanner'
import { PrjctCommandsBase } from './base'
import { requireActiveTask, requireProject } from './guards'

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
      const pid = await requireProject(projectPath)
      if (!pid.ok) return pid.result

      // Value provided → delegate the write (incl. the paused-task resume
      // bypass and the state-machine transition) to task-service, the shared
      // non-printing core. This command owns only the presentation.
      if (value) {
        const outcome = await setTaskStatus(pid.value, projectPath, value)
        if (!outcome.ok) {
          if (outcome.reason === 'unsupported') {
            if (options.md) console.log(`> ${outcome.message}`)
            else out.fail(outcome.message)
            return { success: false, error: outcome.message }
          }
          // No active task and no paused task to resume — emit the uniform guard.
          const task = await requireActiveTask(pid.value, options, projectPath)
          if (!task.ok) return task.result
          return { success: false, error: 'No active task' }
        }
        const msg = `status → ${value}`
        if (options.md) console.log(`✓ ${msg}`)
        else out.done(msg)
        return { success: true, taskId: outcome.taskId, status: value }
      }

      // No-arg `status` → informative display. When the task is paused there's
      // no `currentTask`; show the paused task rather than a bogus "no active
      // task" — the task exists, it just isn't the focus.
      const current = await resolveActiveTask(pid.value, projectPath)
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

      const task = await requireActiveTask(pid.value, options, projectPath)
      if (!task.ok) return task.result

      const active = task.value
      // Recover the last status transition (if any) for this task so the
      // no-args `prjct status` reflects reality, not the task `type` tag.
      const lastStatus = await readLastStatus(pid.value, active.id)
      const line = `Task: ${active.id}  |  Type: ${active.type ?? 'unset'}  |  Status: ${lastStatus ?? 'active'}`
      if (options.md) console.log(line)
      else out.info(line)
      return { success: true, taskId: active.id, status: lastStatus ?? 'active' }
    } catch (error) {
      const msg = getErrorMessage(error)
      return failHard(msg)
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
      const pid = await requireProject(projectPath)
      if (!pid.ok) return pid.result

      const task = await requireActiveTask(pid.value, options, projectPath)
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
      return failHard(msg)
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
        return failHard(parsed.error)
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

      const injectionHits = scanForPromptInjection(content)
      if (injectionHits.length > 0 && !options.force) {
        out.fail(
          `refusing to store memory that looks like prompt injection (${injectionHits.join(', ')}). Entries are inlined into LLM context — re-run with --force if intentional.`
        )
        return { success: false, error: 'Prompt-injection-like content detected' }
      }

      const tags = parseFlagTags(options.tags)

      const pid = await requireProject(projectPath)
      if (!pid.ok) return pid.result

      // `remember` works even without an active task — you might be
      // capturing a fact before kicking off work. Just record without
      // source in that case.
      const active = await resolveActiveTask(pid.value, projectPath)

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
      return failHard(msg)
    }
  }
}

// Helpers (unexported)

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
