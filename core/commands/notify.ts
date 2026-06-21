/**
 * `prjct notify` — desktop notifications toggle (default ON).
 *
 *   prjct notify            → show mode + what fires
 *   prjct notify on|off     → set config.notify.mode
 *
 * prjct pings you (best-effort OS notification) when Claude is waiting for
 * input and when a subagent finishes — so a wait never hangs silently. The
 * mode resolver + the desktop-notify primitive live in `utils/notify.ts` so
 * the cold-path hooks share them without importing this command.
 */

import configManager from '../infrastructure/config-manager'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { failHard, failWith } from '../utils/md-aware'
import { mdOutput } from '../utils/md-formatter'
import { effectiveNotifyMode, NOTIFY_MODES, type NotifyMode } from '../utils/notify'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

export class NotifyCommands extends PrjctCommandsBase {
  async notify(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    const sub = (input ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)[0] ?? ''
    if (!sub || sub === 'status' || sub === 'show') return this.showStatus(projectPath, options)
    if ((NOTIFY_MODES as readonly string[]).includes(sub)) {
      return this.setMode(sub as NotifyMode, projectPath, options)
    }
    return failWith(`Unknown notify subcommand "${sub}". Use: ${NOTIFY_MODES.join('|')}.`, options)
  }

  private async showStatus(projectPath: string, options: MdOption): Promise<CommandResult> {
    const config = await configManager.readConfig(projectPath).catch(() => null)
    if (!config?.projectId)
      return failHard('No prjct project here — run `prjct init` first.', options)

    const mode = effectiveNotifyMode(config)
    const summary = [
      `Mode: ${mode}${mode === 'on' ? ' (default)' : ''}`,
      'Fires on: Claude waiting for input · a subagent finishing',
      'Set: prjct notify on|off',
    ]
    if (options.md) {
      console.log(mdOutput('## Notify', `> **Mode**: \`${mode}\``, summary.slice(1).join('\n')))
    } else {
      out.info(`Notify — ${summary.join('\n  ')}`)
    }
    return { success: true, mode }
  }

  private async setMode(
    mode: NotifyMode,
    projectPath: string,
    options: MdOption
  ): Promise<CommandResult> {
    const config = await configManager.readConfig(projectPath).catch(() => null)
    if (!config?.projectId)
      return failHard('No prjct project here — run `prjct init` first.', options)

    config.notify = { mode }
    await configManager.writeConfig(projectPath, config)

    const msg =
      mode === 'on'
        ? 'Desktop notifications ON — pings on Claude-waiting + subagent-finished.'
        : 'Desktop notifications OFF — silenced (the per-prompt work-state block stays).'
    if (options.md) console.log(mdOutput('## Notify', `> ${msg}`))
    else out.done(msg)
    return { success: true, mode }
  }
}
