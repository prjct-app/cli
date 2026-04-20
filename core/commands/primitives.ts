/**
 * v2 Primitives: status, tag, remember
 *
 * Minimal, composable verbs that let Claude drive work without the CLI
 * imposing opinions. Each is ~40-80 LOC.
 *
 * - status: inline status change on active task (escape hatch, Linear-style)
 * - tag: Claude attaches key:value tags to active task (e.g. type:bug)
 * - remember: Claude saves project memory entries (fact, decision, learning…)
 */

import configManager from '../infrastructure/config-manager'
import type { TaskType } from '../schemas/state'
import { memoryService } from '../services/memory-service'
import { stateStorage } from '../storage/state-storage'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

const MEMORY_TYPES = [
  'fact',
  'decision',
  'learning',
  'gotcha',
  'pattern',
  'anti-pattern',
  'shipped',
] as const

type MemoryType = (typeof MEMORY_TYPES)[number]

const TASK_TYPE_VALUES: readonly TaskType[] = ['feature', 'bug', 'improvement', 'chore']

export class PrimitiveCommands extends PrjctCommandsBase {
  /**
   * /p:status <value>
   *
   * Escape hatch for changing the active task's status without routing through
   * a workflow. Mirrors Linear's inline status dropdown. Workflows are the
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

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      const active = await stateStorage.getCurrentTask(projectId)
      if (!active) {
        const msg = 'No active task — start one with `prjct task "<desc>"`'
        if (options.md) console.log(`> ${msg}`)
        else out.warn('no active task')
        return { success: false, error: msg }
      }

      if (!value) {
        const line = `Task: ${active.id}  |  Status: ${active.type ?? 'unset'}`
        if (options.md) console.log(line)
        else out.info(line)
        return { success: true, taskId: active.id, status: active.type }
      }

      // Persist via memory event; the v2 workflow engine is the canonical
      // status-change path (coming in PR 4). Until then this writes the
      // event so UI/history can reflect it.
      await memoryService.log(projectPath, 'status.changed', {
        taskId: active.id,
        from: active.type ?? null,
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
   * Attach key:value tags to the active task. Claude decides what to tag
   * (type:bug, domain:frontend, priority:high, …). If `type` is tagged and
   * matches a known task type, the tasks.type column is updated; everything
   * else is stored as a memory event so it survives across sessions.
   */
  async tag(
    args: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      const active = await stateStorage.getCurrentTask(projectId)
      if (!active) {
        const msg = 'No active task — start one with `prjct task "<desc>"`'
        if (options.md) console.log(`> ${msg}`)
        else out.warn('no active task')
        return { success: false, error: msg }
      }

      if (!args) {
        out.info('Usage: prjct tag <key:value> [<key:value>...]')
        return { success: false, error: 'No tags provided' }
      }

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

      if (pairs.length === 0) {
        out.fail('no valid k:v pairs (expected `key:value`)')
        return { success: false, error: 'Invalid tag format' }
      }

      const tags: Record<string, string> = Object.fromEntries(pairs)

      // If Claude tagged `type:<taskType>`, promote to the task column.
      const typeTag = tags.type
      if (typeTag && (TASK_TYPE_VALUES as readonly string[]).includes(typeTag)) {
        await stateStorage.updateCurrentTask(projectId, { type: typeTag as TaskType })
      }

      await memoryService.log(projectPath, 'task.tagged', {
        taskId: active.id,
        tags,
      })

      const pretty = Object.entries(tags)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
      if (options.md) console.log(`✓ tagged ${pretty}`)
      else out.done(`tagged ${pretty}`)
      return { success: true, taskId: active.id, tags }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }

  /**
   * /p:remember <type> "<content>" [--tags k:v,...]
   *
   * Claude captures a project memory entry. Types: fact | decision | learning
   * | gotcha | pattern | anti-pattern | shipped. Storage is event-based for
   * now; PR 4 consolidates into a first-class project-memory API.
   */
  async remember(
    args: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean; tags?: string } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      if (!args) {
        out.info(
          'Usage: prjct remember <type> "<content>" [--tags k:v,...]\n' +
            `Types: ${MEMORY_TYPES.join(' | ')}`
        )
        return { success: false, error: 'Missing args' }
      }

      // First whitespace-separated token is the type.
      const trimmed = args.trim()
      const firstSpace = trimmed.search(/\s/)
      if (firstSpace <= 0) {
        out.fail('expected `<type> "<content>"`')
        return { success: false, error: 'Invalid format' }
      }

      const typeStr = trimmed.slice(0, firstSpace).toLowerCase()
      if (!(MEMORY_TYPES as readonly string[]).includes(typeStr)) {
        out.fail(`unknown type '${typeStr}'. Valid: ${MEMORY_TYPES.join(' | ')}`)
        return { success: false, error: 'Invalid memory type' }
      }
      const type = typeStr as MemoryType

      // Content: strip surrounding quotes if present.
      let content = trimmed.slice(firstSpace + 1).trim()
      if (
        (content.startsWith('"') && content.endsWith('"')) ||
        (content.startsWith("'") && content.endsWith("'"))
      ) {
        content = content.slice(1, -1)
      }
      if (!content) {
        out.fail('content is required')
        return { success: false, error: 'Missing content' }
      }

      const tags: Record<string, string> = {}
      if (options.tags) {
        for (const raw of options.tags.split(',')) {
          const pair = raw.trim()
          const idx = pair.indexOf(':')
          if (idx > 0) tags[pair.slice(0, idx)] = pair.slice(idx + 1)
        }
      }

      await memoryService.log(projectPath, `remember.${type}`, {
        type,
        content,
        tags,
      })

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
