/**
 * Preferences Commands — `prjct prefs <subcommand>` (gstack-inspired).
 *
 * `prjct prefs set <id> <preference> [--reason "..."]`
 * `prjct prefs get <id>`
 * `prjct prefs check <id>`           — emits ASK_NORMALLY|AUTO_DECIDE|NEVER_ASK
 * `prjct prefs list`                  — show all
 * `prjct prefs clear [<id>]`          — clear one or all
 *
 * Backed by `core/storage/preferences-storage.ts`. The CLI parses an
 * argv slice and delegates; storage validates the id shape.
 */

import {
  isValidPreference,
  isValidQuestionId,
  preferencesStorage,
  type QuestionPreference,
} from '../storage/preferences-storage'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'
import { requireProjectId } from './guards'

interface PrefsOptions {
  md?: boolean
  reason?: string
}

export class PreferencesCommands extends PrjctCommandsBase {
  /**
   * Subcommand dispatcher. `args` is the rest of argv after `prefs`.
   */
  async prefs(
    args: string[],
    projectPath: string = process.cwd(),
    options: PrefsOptions = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const pid = await requireProjectId(projectPath)
      if (!pid.ok) return pid.result

      const subcommand = args[0] ?? 'list'
      const rest = args.slice(1)

      switch (subcommand) {
        case 'list':
          return this.handleList(pid.value, options)
        case 'get':
          return this.handleGet(pid.value, rest, options)
        case 'check':
          return this.handleCheck(pid.value, rest)
        case 'set':
          return this.handleSet(pid.value, rest, options)
        case 'clear':
          return this.handleClear(pid.value, rest, options)
        default:
          out.fail(`Unknown prefs subcommand: ${subcommand}. Use: list, get, check, set, clear.`)
          return { success: false, error: `Unknown subcommand: ${subcommand}` }
      }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }

  private handleList(projectId: string, options: PrefsOptions): CommandResult {
    const entries = preferencesStorage.list(projectId)
    if (options.md) {
      if (entries.length === 0) {
        console.log('## Question preferences\n\n_No preferences set._\n')
      } else {
        const rows = entries
          .map(
            (e) =>
              `| ${e.questionId} | ${e.preference} | ${e.setAt} | ${e.reason ? e.reason.replaceAll('|', '\\|') : ''} |`
          )
          .join('\n')
        console.log(
          `## Question preferences\n\n| Question | Preference | Set at | Reason |\n|---|---|---|---|\n${rows}\n`
        )
      }
    } else if (entries.length === 0) {
      out.info('No question preferences set.')
    } else {
      for (const e of entries) {
        const reason = e.reason ? ` — ${e.reason}` : ''
        console.log(`${e.preference.padEnd(11)}  ${e.questionId}${reason}`)
      }
    }
    return { success: true, count: entries.length, entries }
  }

  private handleGet(projectId: string, rest: string[], options: PrefsOptions): CommandResult {
    const id = rest[0]
    if (!id) {
      out.fail('Usage: prjct prefs get <questionId>')
      return { success: false, error: 'Missing questionId' }
    }
    if (!isValidQuestionId(id)) {
      out.fail(`Invalid questionId "${id}".`)
      return { success: false, error: 'Invalid questionId' }
    }
    const entry = preferencesStorage.get(projectId, id)
    if (!entry) {
      if (options.md) {
        console.log(`## prefs get \`${id}\`\n\n_no preference set_\n`)
      } else {
        out.info(`no preference set for ${id}`)
      }
      return { success: true, entry: null }
    }
    if (options.md) {
      console.log(
        `## prefs get \`${id}\`\n\n- **Preference**: ${entry.preference}\n- **Set at**: ${entry.setAt}${entry.reason ? `\n- **Reason**: ${entry.reason}` : ''}\n`
      )
    } else {
      const reason = entry.reason ? ` (${entry.reason})` : ''
      console.log(`${entry.preference}  ${entry.questionId}${reason}`)
    }
    return { success: true, entry }
  }

  /**
   * Output is ONE LINE so a skill preamble can pipe it from the shell.
   * Same contract as gstack's `gstack-question-preference --check`.
   */
  private handleCheck(projectId: string, rest: string[]): CommandResult {
    const id = rest[0]
    if (!id) {
      out.fail('Usage: prjct prefs check <questionId>')
      return { success: false, error: 'Missing questionId' }
    }
    if (!isValidQuestionId(id)) {
      // Default to ASK_NORMALLY for unknown ids — the skill prompt is
      // the safest fallback when the id can't even be looked up.
      console.log('ASK_NORMALLY')
      return { success: true, check: 'ASK_NORMALLY' }
    }
    const check = preferencesStorage.check(projectId, id)
    console.log(check)
    return { success: true, check }
  }

  private handleSet(projectId: string, rest: string[], options: PrefsOptions): CommandResult {
    const [id, preference] = rest
    if (!id || !preference) {
      out.fail(
        'Usage: prjct prefs set <questionId> <preference> [--reason "..."]\nPreferences: always-ask | never-ask | auto-decide'
      )
      return { success: false, error: 'Missing args' }
    }
    if (!isValidQuestionId(id)) {
      out.fail(`Invalid questionId "${id}".`)
      return { success: false, error: 'Invalid questionId' }
    }
    if (!isValidPreference(preference)) {
      out.fail(`Invalid preference "${preference}". Use: always-ask, never-ask, auto-decide.`)
      return { success: false, error: 'Invalid preference' }
    }
    const entry = preferencesStorage.set(projectId, {
      questionId: id,
      preference: preference as QuestionPreference,
      reason: options.reason,
    })
    if (options.md) {
      console.log(
        `## prefs set\n\n\`${entry.questionId}\` → \`${entry.preference}\`${entry.reason ? ` — ${entry.reason}` : ''}\n`
      )
    } else {
      out.done(`prefs ${entry.questionId} → ${entry.preference}`)
    }
    return { success: true, entry }
  }

  private handleClear(projectId: string, rest: string[], options: PrefsOptions): CommandResult {
    const id = rest[0]
    if (id && !isValidQuestionId(id)) {
      out.fail(`Invalid questionId "${id}".`)
      return { success: false, error: 'Invalid questionId' }
    }
    const cleared = preferencesStorage.clear(projectId, id)
    if (options.md) {
      const subject = id ? `\`${id}\`` : 'all preferences'
      console.log(
        `## prefs clear\n\nCleared ${cleared} entr${cleared === 1 ? 'y' : 'ies'} (${subject}).\n`
      )
    } else if (cleared === 0) {
      out.info(id ? `no preference set for ${id}` : 'no preferences to clear')
    } else {
      out.done(`cleared ${cleared} preference${cleared === 1 ? '' : 's'}`)
    }
    return { success: true, cleared }
  }
}
