/**
 * `prjct cloud` — control surface for the paid cloud-sync layer.
 *
 * One registered verb, subcommand-parsed (same shape as `prjct lean`):
 *
 *   prjct cloud                  → status (linked? paused? pending? last sync?)
 *   prjct cloud link             → opt THIS project in (requires `prjct login`)
 *   prjct cloud unlink           → back to local-only (local data untouched)
 *   prjct cloud sync             → push pending + pull remote now
 *   prjct cloud pull             → pull remote only (fresh second machine)
 *   prjct cloud pause | resume   → stop / restart sync without unlinking
 *
 * Local-first contract: nothing leaves the machine until a project is linked
 * (`config.cloud.enabled`). The CLI only carries the token (in `auth.json`)
 * and talks to a storage API — it knows nothing about how the cloud stores
 * the data, and has ZERO paywall logic: paid limits are enforced server-side
 * and surfaced here verbatim (e.g. a 402 upgrade message).
 */

import path from 'node:path'
import { syncEventBus } from '../events/sync-events'
import configManager from '../infrastructure/config-manager'
import { buildProjectMeta } from '../services/sync/project-meta'
import authConfig from '../sync/auth-config'
import { addLinkedProject, removeLinkedProject } from '../sync/cloud-registry'
import { DEFAULT_INCLUDE } from '../sync/entity-map'
import realtimeManager from '../sync/realtime-manager'
import syncClient from '../sync/sync-client'
import syncManager from '../sync/sync-manager'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import type { LocalConfig } from '../types/config'
import { getErrorMessage } from '../types/fs'
import { failHard, failWith } from '../utils/md-aware'
import { mdOutput } from '../utils/md-formatter'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

const SUBCOMMANDS = ['link', 'unlink', 'status', 'sync', 'pull', 'pause', 'resume'] as const

export class CloudCommands extends PrjctCommandsBase {
  async cloud(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    const parts = (input ?? '').trim().split(/\s+/).filter(Boolean)
    const sub = (parts[0] ?? '').toLowerCase()

    if (!sub || sub === 'status' || sub === 'show') return this.status(projectPath, options)
    switch (sub) {
      case 'link':
        return this.link(projectPath, options)
      case 'unlink':
        return this.unlink(projectPath, options)
      case 'sync':
        return this.runSync(projectPath, options)
      case 'pull':
        return this.runPull(projectPath, options)
      case 'pause':
        return this.setPaused(true, projectPath, options)
      case 'resume':
        return this.setPaused(false, projectPath, options)
      default:
        return failWith(
          `Unknown cloud subcommand "${sub}". Use: ${SUBCOMMANDS.join(', ')}.`,
          options
        )
    }
  }

  /** Read the local config, or null when this isn't a prjct project. */
  private async readProject(projectPath: string): Promise<LocalConfig | null> {
    const config = await configManager.readConfig(projectPath).catch(() => null)
    return config?.projectId ? config : null
  }

  /** Opt this project into cloud sync and push an initial snapshot. */
  private async link(projectPath: string, options: MdOption): Promise<CommandResult> {
    const config = await this.readProject(projectPath)
    if (!config) return failHard('No prjct project here — run `prjct init` first.', options)
    if (!(await authConfig.hasAuth())) {
      return failHard('Not authenticated. Run `prjct login`, then `prjct cloud link`.', options)
    }

    const linkedCloud = {
      enabled: true,
      paused: false,
      linkedAt: config.cloud?.linkedAt ?? new Date().toISOString(),
      include: config.cloud?.include,
    }
    const meta = await buildProjectMeta(config.projectId).catch(() => undefined)
    const link = await syncClient.linkProject(config.projectId, path.basename(projectPath), meta)
    config.cloud = linkedCloud
    await configManager.writeConfig(projectPath, config)

    if (link.syncStatus === 'active') {
      await addLinkedProject(config.projectId, projectPath)
      // Open the realtime connection (no-op outside the daemon — the daemon
      // reopens it from the registry on its next boot).
      await realtimeManager.start(config.projectId, projectPath).catch(() => undefined)
      const result = await syncManager.sync(config.projectId, {
        include: config.cloud.include ?? {},
      })
      return this.reportSync('Linked', result, options, {
        extra: 'Project is now linked. It will also sync on `prjct ship` and at session end.',
      })
    }

    return this.subscriptionRequired(link.message, options, {
      title:
        link.syncStatus === 'payment_pending'
          ? 'Cloud sync waiting for payment'
          : 'Cloud sync waiting for subscription',
      prefix: `Repo linked to your prjct account. Billing: ${link.billingUrl}`,
    })
  }

  /** Detach from cloud — local DB is untouched. */
  private async unlink(projectPath: string, options: MdOption): Promise<CommandResult> {
    const config = await this.readProject(projectPath)
    if (!config) return failHard('No prjct project here — run `prjct init` first.', options)
    if (!config.cloud?.enabled) {
      const msg = 'Already local-only — nothing to unlink.'
      console.log(options.md ? mdOutput('## Cloud', `> ${msg}`) : msg)
      return { success: true, linked: false }
    }
    config.cloud = { ...config.cloud, enabled: false, paused: false }
    await configManager.writeConfig(projectPath, config)
    realtimeManager.stop(config.projectId)
    await removeLinkedProject(config.projectId)
    const msg = 'Unlinked — this project is local-only again. Local data was not touched.'
    if (options.md) console.log(mdOutput('## Cloud', `> ${msg}`))
    else out.done(msg)
    return { success: true, linked: false }
  }

  /** Manual push + pull. */
  private async runSync(projectPath: string, options: MdOption): Promise<CommandResult> {
    const config = await this.readProject(projectPath)
    if (!config) return failHard('No prjct project here — run `prjct init` first.', options)
    const gate = this.gate(config, options)
    if (gate) return gate
    const result = await syncManager.sync(config.projectId, {
      include: config.cloud?.include ?? {},
    })
    return this.reportSync('Synced', result, options)
  }

  /** Pull-only — the move for a fresh second machine. */
  private async runPull(projectPath: string, options: MdOption): Promise<CommandResult> {
    const config = await this.readProject(projectPath)
    if (!config) return failHard('No prjct project here — run `prjct init` first.', options)
    const gate = this.gate(config, options)
    if (gate) return gate
    try {
      const result = await syncManager.pull(config.projectId)
      if (!result.success) {
        if (result.code === 'PAYMENT_REQUIRED')
          return this.subscriptionRequired(result.error, options)
        return failWith(`Pull failed: ${result.error ?? 'unknown error'}`, options)
      }
      const msg = `Pulled ${result.count ?? 0} change(s) (${result.applied ?? 0} applied).`
      if (options.md) console.log(mdOutput('## Cloud pull', `> ${msg}`))
      else out.done(msg)
      return { success: true, pulled: result.count ?? 0, applied: result.applied ?? 0 }
    } catch (error) {
      return failHard(getErrorMessage(error), options)
    }
  }

  /** Pause/resume without unlinking. */
  private async setPaused(
    paused: boolean,
    projectPath: string,
    options: MdOption
  ): Promise<CommandResult> {
    const config = await this.readProject(projectPath)
    if (!config) return failHard('No prjct project here — run `prjct init` first.', options)
    if (!config.cloud?.enabled) {
      return failWith(
        'Not linked — nothing to pause/resume. Run `prjct cloud link` first.',
        options
      )
    }
    config.cloud = { ...config.cloud, paused }
    await configManager.writeConfig(projectPath, config)
    if (paused) realtimeManager.stop(config.projectId)
    else await realtimeManager.start(config.projectId, projectPath).catch(() => undefined)
    const msg = paused
      ? 'Cloud sync paused. Resume with `prjct cloud resume`.'
      : 'Cloud sync resumed.'
    if (options.md) console.log(mdOutput('## Cloud', `> ${msg}`))
    else out.done(msg)
    return { success: true, paused }
  }

  /** Linked + active + authed snapshot for status. */
  private async status(projectPath: string, options: MdOption): Promise<CommandResult> {
    const config = await this.readProject(projectPath)
    if (!config) return failHard('No prjct project here — run `prjct init` first.', options)

    const authed = await authConfig.hasAuth()
    const cloud = config.cloud
    const linked = !!cloud?.enabled
    const paused = !!cloud?.paused
    const pending = (await syncEventBus.getPending(config.projectId)).length
    const lastSync = await syncEventBus.getLastSync(config.projectId)
    const include = { ...DEFAULT_INCLUDE, ...(cloud?.include ?? {}) }
    const onGroups = Object.entries(include)
      .filter(([, v]) => v)
      .map(([k]) => k)

    const state = !authed
      ? 'not authenticated (run `prjct login`)'
      : !linked
        ? 'local-only (run `prjct cloud link`)'
        : paused
          ? 'linked, paused'
          : 'linked, active'

    // Realtime only runs inside the daemon; report its live connection state
    // there, otherwise say it needs the daemon (pull-based sync still works).
    const realtime = !linked
      ? 'n/a'
      : realtimeManager.available()
        ? realtimeManager.status(config.projectId)
        : 'requires daemon'

    if (options.md) {
      console.log(
        mdOutput(
          '## Cloud status',
          `> **State**: ${state}`,
          [
            `- Authenticated: ${authed ? 'yes' : 'no'}`,
            `- Linked: ${linked ? 'yes' : 'no'}${cloud?.linkedAt ? ` (since ${cloud.linkedAt})` : ''}`,
            `- Realtime: ${realtime}`,
            `- Pending events: ${pending}`,
            `- Last sync: ${lastSync?.timestamp ?? 'never'}`,
            `- Syncing groups: ${onGroups.join(', ')}`,
          ].join('\n')
        )
      )
    } else {
      out.info(
        [
          `Cloud — ${state}`,
          `  Authenticated: ${authed ? 'yes' : 'no'}`,
          `  Linked: ${linked ? 'yes' : 'no'}${cloud?.linkedAt ? ` (since ${cloud.linkedAt})` : ''}`,
          `  Realtime: ${realtime}`,
          `  Pending events: ${pending}`,
          `  Last sync: ${lastSync?.timestamp ?? 'never'}`,
          `  Syncing groups: ${onGroups.join(', ')}`,
        ].join('\n')
      )
    }
    return { success: true, linked, paused, authed, pending, realtime }
  }

  /** Shared gate for sync/pull: linked + not paused + authenticated. */
  private gate(config: LocalConfig, options: MdOption): CommandResult | null {
    if (!config.cloud?.enabled) {
      return failWith('This project is not linked. Run `prjct cloud link` first.', options)
    }
    if (config.cloud.paused) {
      return failWith('Cloud sync is paused. Run `prjct cloud resume` first.', options)
    }
    return null
  }

  /**
   * Subscription lapsed/absent — the server's 402 paid gate. The message text
   * is authored server-side (the CLI has zero paywall logic) and surfaced here
   * as a clear, dedicated notice rather than a generic sync error.
   */
  private subscriptionRequired(
    reason: string | undefined,
    options: MdOption,
    opts?: { title?: string; prefix?: string }
  ): CommandResult {
    const msg =
      reason ??
      'Cloud sync needs an active prjct subscription. Your local data is safe — only cloud backup is paused.'
    if (options.md) {
      console.log(
        mdOutput(
          `## ${opts?.title ?? 'Subscription required'}`,
          `> 💳 ${opts?.prefix ? `${opts.prefix}\n\n${msg}` : msg}`
        )
      )
    } else {
      out.warn(opts?.title ?? 'Cloud backup paused — subscription required')
      if (opts?.prefix) out.info(opts.prefix)
      out.info(msg)
    }
    // Not a hard failure: local-first work continues; only cloud sync is gated.
    return { success: false, paymentRequired: true, message: msg }
  }

  /** Render a push+pull SyncResult (also used by link). */
  private reportSync(
    label: string,
    result: Awaited<ReturnType<typeof syncManager.sync>>,
    options: MdOption,
    opts?: { extra?: string }
  ): CommandResult {
    if (!result.success) {
      // The server's 402 paid gate gets a dedicated, friendly notice.
      if (result.code === 'PAYMENT_REQUIRED')
        return this.subscriptionRequired(result.error, options)
      // Other server-side errors surface verbatim.
      return failWith(`${label} with errors: ${result.error ?? 'unknown error'}`, options)
    }
    const pushed = result.pushed?.count ?? 0
    const pulled = result.pulled?.count ?? 0
    const msg = `${label} — ${pushed} pushed, ${pulled} pulled.`
    if (options.md) {
      console.log(mdOutput('## Cloud', `> ${msg}`, ...(opts?.extra ? [opts.extra] : [])))
    } else {
      out.done(msg)
      if (opts?.extra) out.info(opts.extra)
    }
    return { success: true, pushed, pulled }
  }
}
