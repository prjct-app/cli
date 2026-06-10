/**
 * Daemon command dispatch — translates a wire-protocol DaemonRequest into
 * a PrjctCommands method call.
 *
 * Mirrors the routing in `core/index.ts` so the daemon path and the
 * direct path produce identical results. Special cases (sync, ship,
 * task, etc.) are explicit because they need typed option destructuring.
 */

import { findClosestCommand } from '../commands/closest-command'
import type { PrjctCommands } from '../commands/commands'
import { mapOptions } from '../commands/option-mapper'
import { commandRegistry } from '../commands/registry'
import { isRemovedVerb, migrationMessage } from '../commands/removed-verbs'
import { routeSpec } from '../commands/route-spec'
import type { CommandResult } from '../types/commands'
import type { DaemonRequest } from '../types/daemon'

export async function executeCommand(
  commands: PrjctCommands,
  request: DaemonRequest
): Promise<CommandResult> {
  const param = request.args.join(' ') || null
  const opts = request.options
  const md = opts.md === true

  // Short-circuit v2-removed verbs with a migration message so the daemon
  // path matches the fallback path in core/index.ts. Otherwise users get
  // a generic "Unknown command" from the registry with no migration hint.
  if (isRemovedVerb(request.command) && !commandRegistry.getByName(request.command)) {
    const msg = migrationMessage(request.command) ?? `'${request.command}' was removed in v2.`
    return { success: false, error: msg }
  }

  // Mirror the v2 GTD auto-route from core/index.ts: an unknown verb
  // becomes `prjct capture "<verb plus args>"` so dumps without ceremony
  // land in the inbox. Single-word near-typos of a real verb still bubble
  // up as "Command not found" (handled by the default switch case below)
  // so users don't silently capture e.g. "shipp".
  if (
    request.command &&
    !commandRegistry.getByName(request.command) &&
    !(request.args.length === 0 && findClosestCommand(request.command) !== null)
  ) {
    const fullDescription = [
      request.command,
      ...request.args.filter((a) => !a.startsWith('-')),
    ].join(' ')
    return commands.capture(fullDescription, request.cwd, {
      md,
      tags: opts.tags ? String(opts.tags) : undefined,
      force: opts.force === true,
    })
  }

  // Manifest-driven dispatch: any command with an `optionSchema` gets its
  // flags mapped generically and is invoked through the option-aware
  // registry bridge — (param, projectPath, options). A schema-covered
  // command can never lose its options by missing a hand-written case
  // (the daemon flag-strip bug class, mem_1102/1103).
  const meta = commandRegistry.getByName(request.command)
  if (meta?.optionSchema) {
    return commandRegistry.executeWithOptions(
      request.command,
      param,
      request.cwd,
      mapOptions(opts, meta.optionSchema)
    )
  }

  // Complex-signature commands: object params, multi-positional routing,
  // or non-(param, projectPath, options) method shapes. These are the ONLY
  // commands allowed an explicit case — manifest-completeness.test.ts
  // fails if a schema-covered command grows one.
  switch (request.command) {
    case 'sync':
      return commands.sync(request.cwd, {
        preview: opts.preview === true || opts['dry-run'] === true,
        yes: opts.yes === true,
        json: opts.json === true,
        md,
        package: opts.package ? String(opts.package) : undefined,
        full: opts.full === true,
      })
    case 'spec':
      return routeSpec(commands, request.args, opts, request.cwd)
    case 'audit-spec':
      if (!param) {
        return { success: false, error: 'audit-spec requires a spec id' }
      }
      return commands.specAudit(param, request.cwd, { md })
    case 'analyze':
      return commands.analyze(opts, request.cwd)
    case 'analysis-save-llm':
      if (!param) {
        return {
          success: false,
          error: 'analysis-save-llm requires a JSON payload as positional arg',
        }
      }
      return commands.saveLlmAnalysis(param, request.cwd, { md })
    case 'init':
      // request.cwd (NOT the daemon's process.cwd) is the project dir.
      return commands.init(
        {
          idea: param,
          yes: opts.yes === true,
          pack: opts.pack ? String(opts.pack) : undefined,
          persona: opts.persona ? String(opts.persona) : undefined,
        },
        request.cwd
      )
    case 'regen':
      return commands.regenVault(request.cwd, { md })
    case 'login':
      return commands.login({ md, url: opts.url ? String(opts.url) : undefined })
    case 'logout':
      return commands.logout()
    case 'auth':
      return commands.auth(param, { md })
    default:
      // Standard commands without special option handling
      return commandRegistry.execute(request.command, param, request.cwd)
  }
}
