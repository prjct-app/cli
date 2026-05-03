/**
 * `prjct seed` — activate/list/remove packs on the current project.
 *
 * A pack only activates signals (memory types, workflow-slot names,
 * suggested MCPs). No bash is written, no lock-ins — deactivating
 * cleanly removes the pack from `persona.packs` and that's it.
 */

import { PACK_MANIFESTS, PACK_NAMES } from '../packs/manifests'
import {
  activatePacks,
  deactivatePacks,
  detectSuggestedPacks,
  listActivePacks,
} from '../packs/pack-manager'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { failHard } from '../utils/md-aware'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

export class SeedCommands extends PrjctCommandsBase {
  /**
   * `prjct seed <subcommand> [input]` — single entry the command
   * registry can target. Parses subcommand + rest from the input
   * string so we can register one method instead of four.
   */
  async seed(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    const parts = (input ?? '').trim().split(/\s+/).filter(Boolean)
    const sub = parts[0] ?? 'list'
    const rest = parts.slice(1).join(',')
    switch (sub) {
      case 'add':
        return this.add(rest || null, projectPath, options)
      case 'remove':
        return this.remove(rest || null, projectPath, options)
      case 'list':
        return this.list(null, projectPath, options)
      case 'suggest':
        return this.suggest(null, projectPath, options)
      default:
        out.fail(`Unknown seed subcommand: ${sub}. Use: add, remove, list, suggest.`)
        return { success: false, error: 'Unknown seed subcommand' }
    }
  }

  /**
   * /p:seed add <pack>[,<pack>...]
   *
   * Adds one or more packs to this project. Idempotent — already-active
   * packs are silently skipped; unknown pack names are reported.
   */
  async add(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean; suggestPersona?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      if (!input) {
        out.info(`Usage: prjct seed add <pack>[,<pack>...]\nAvailable: ${PACK_NAMES.join(', ')}`)
        return { success: false, error: 'No pack given' }
      }
      const names = input
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const result = await activatePacks(projectPath, names, {
        suggestPersona: options.suggestPersona ?? false,
      })

      const msg = `activated: ${result.activated.join(', ') || 'none'}${
        result.skipped.length ? ` • unknown: ${result.skipped.join(', ')}` : ''
      }`
      if (options.md) console.log(`✓ ${msg}`)
      else out.done(msg)
      return { success: true, ...result }
    } catch (error) {
      const msg = getErrorMessage(error)
      return failHard(msg)
    }
  }

  /**
   * /p:seed remove <pack>[,<pack>...] — deactivate without touching
   * captured memory or saved workflows.
   */
  async remove(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      if (!input) {
        out.info('Usage: prjct seed remove <pack>[,<pack>...]')
        return { success: false, error: 'No pack given' }
      }
      const names = input
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const result = await deactivatePacks(projectPath, names)
      const msg = `deactivated: ${result.deactivated.join(', ') || 'none'}${
        result.notActive.length ? ` • not active: ${result.notActive.join(', ')}` : ''
      }`
      if (options.md) console.log(`✓ ${msg}`)
      else out.done(msg)
      return { success: true, ...result }
    } catch (error) {
      const msg = getErrorMessage(error)
      return failHard(msg)
    }
  }

  /**
   * /p:seed list — show active packs and what each contributes.
   */
  async list(
    _input: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      const active = await listActivePacks(projectPath)
      if (active.length === 0) {
        const msg = `no packs active. Run \`prjct seed add <name>\` — available: ${PACK_NAMES.join(', ')}`
        if (options.md) console.log(`> ${msg}`)
        else out.info(msg)
        return { success: true, active: [] }
      }

      if (options.md) {
        const lines = ['# Active packs', '']
        for (const p of active) {
          lines.push(`## ${p.name}`)
          lines.push(p.description)
          lines.push(`- memory types: ${p.memoryTypes.join(', ') || '—'}`)
          lines.push(`- workflow slots: ${p.slots.join(', ') || '—'}`)
          lines.push('')
        }
        console.log(lines.join('\n'))
      } else {
        for (const p of active) {
          out.info(`${p.name}: ${p.description}`)
          out.info(`  memory: ${p.memoryTypes.join(', ') || '—'}`)
          out.info(`  slots:  ${p.slots.join(', ') || '—'}`)
        }
      }
      return { success: true, active }
    } catch (error) {
      const msg = getErrorMessage(error)
      return failHard(msg)
    }
  }

  /**
   * /p:seed suggest — auto-detect which packs likely fit this project.
   * Pure information; never activates anything.
   */
  async suggest(
    _input: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      const names = await detectSuggestedPacks(projectPath)
      const details = names.map((n) => {
        const m = PACK_MANIFESTS[n]
        return { name: n, description: m?.description ?? '' }
      })

      if (options.md) {
        const lines = ['# Suggested packs for this project', '']
        for (const p of details) lines.push(`- **${p.name}** — ${p.description}`)
        lines.push('')
        lines.push(`Activate with: \`prjct seed add ${names.join(',')}\``)
        console.log(lines.join('\n'))
      } else {
        out.info(`Suggested: ${names.join(', ')}`)
        out.info(`Activate: prjct seed add ${names.join(',')}`)
      }
      return { success: true, suggested: names }
    } catch (error) {
      const msg = getErrorMessage(error)
      return failHard(msg)
    }
  }
}
