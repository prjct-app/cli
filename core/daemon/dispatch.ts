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

  // Commands that need options routed through PrjctCommands
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
    case 'task':
      return commands.task(param, request.cwd, {
        md,
        spec: opts.spec ? String(opts.spec) : undefined,
      })
    case 'ship': {
      const intent = typeof opts.intent === 'string' ? (opts.intent as string) : undefined
      return commands.ship(param, request.cwd, {
        md,
        intent: intent as 'register-only' | 'seed-code-workflow' | 'proceed' | undefined,
        skipHooks: opts['skip-hooks'] === true,
        noSpecGate: opts['no-spec-gate'] === true,
      })
    }
    case 'spec':
      return routeSpec(commands, request.args, opts, request.cwd)
    case 'audit-spec':
      if (!param) {
        return { success: false, error: 'audit-spec requires a spec id' }
      }
      return commands.specAudit(param, request.cwd, { md })
    case 'workflow':
      return commands.workflowPrefs(param, request.cwd, { md })
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
    case 'status':
      return commands.status(param, request.cwd, { md })
    case 'tag':
      return commands.tag(param, request.cwd, { md })
    case 'remember':
      return commands.remember(param, request.cwd, {
        md,
        tags: opts.tags ? String(opts.tags) : undefined,
      })
    case 'mcp':
      // Explicit case (not registry.execute) because the registry wrapper
      // calls `mcp(projectPath)` when param is null — which makes `mcp` parse
      // the cwd as a subcommand. `p. mcp` from Claude Code hits exactly that
      // path and was returning "Unknown mcp subcommand: /Users/…".
      return commands.mcp(param, request.cwd, { md })
    case 'team':
      return commands.team(param, request.cwd, {
        md,
        required: opts.required === true,
        minVersion: opts['min-version'] ? String(opts['min-version']) : undefined,
        enforce: opts.enforce === true,
      })
    case 'config':
      return commands.config(param, request.cwd, { md })
    case 'guard':
      return commands.guard(param, request.cwd, {
        md,
        limit: opts.limit ? Number(opts.limit) : undefined,
      })
    case 'embeddings':
      // Must mirror the cold path (core/index.ts): the default
      // registry.execute path drops option flags, so `prjct embeddings set
      // --key …` via the daemon silently lost the key (set became a no-op).
      return commands.embeddings(param, request.cwd, {
        md,
        key: opts.key ? String(opts.key) : undefined,
        model: opts.model ? String(opts.model) : undefined,
        baseUrl: opts['base-url'] ? String(opts['base-url']) : undefined,
      })
    default:
      // Standard commands without special option handling
      return commandRegistry.execute(request.command, param, request.cwd)
  }
}
