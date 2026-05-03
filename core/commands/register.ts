/**
 * Command Registration — drives the central commandRegistry off the
 * declarative routing table in `command-data.ts`.
 *
 * Adding a new verb is now a single edit in one file:
 *   1. Add (or update) the entry in command-data.ts
 *   2. Set its `routing: { group, method }` field
 *   3. (Optional) ensure the group instance is wired below
 *
 * Both `register.ts` AND `verb-names.ts` derive from the same table,
 * so the historical "triple-touch" (verb-names + register + commands)
 * is now a single touchpoint for the verb→handler mapping.
 */

import type { CommandRoutingGroup } from '../types/commands'
import { AnalysisCommands } from './analysis'
import { CaptureCommands } from './capture'
import { CATEGORIES, COMMANDS } from './command-data'
import { ConfigCommands } from './config'
import { ContextCommands } from './context'
import { InstallCommands } from './install'
import { McpCommands } from './mcp'
import { PlanningCommands } from './planning'
import { PrimitiveCommands } from './primitives'
import { commandRegistry } from './registry'
import { SeedCommands } from './seed'
import { SetupCommands } from './setup'
import { ShippingCommands } from './shipping'
import { SpecCommands } from './spec'
import { TeamCommands } from './team'
import { UninstallCommands } from './uninstall'
import { UpdateCommands } from './update'
import { WorkflowCommands } from './workflow'

// One singleton per command group — instances live for the process
// lifetime, so the registry binds methods once and reuses the closure.
const groupInstances: Record<CommandRoutingGroup, object> = {
  workflow: new WorkflowCommands(),
  planning: new PlanningCommands(),
  shipping: new ShippingCommands(),
  analysis: new AnalysisCommands(),
  setup: new SetupCommands(),
  context: new ContextCommands(),
  primitives: new PrimitiveCommands(),
  seed: new SeedCommands(),
  install: new InstallCommands(),
  capture: new CaptureCommands(),
  mcp: new McpCommands(),
  team: new TeamCommands(),
  config: new ConfigCommands(),
  uninstall: new UninstallCommands(),
  update: new UpdateCommands(),
  spec: new SpecCommands(),
}

function registerCategories(): void {
  for (const [name, info] of Object.entries(CATEGORIES)) {
    commandRegistry.registerCategory(name, info)
  }
}

/**
 * Register every command whose metadata declares `routing`. Called
 * once on module import — this module is imported only for its
 * side effect (see `core/index.ts` and `core/daemon/daemon.ts`).
 */
function registerAllCommands(): void {
  // Skip if already registered
  if (commandRegistry.has('work')) return

  registerCategories()

  for (const meta of COMMANDS) {
    if (!meta.routing) continue
    const instance = groupInstances[meta.routing.group] as Record<string, unknown>
    // The registry validates `methodName` is a function on the instance at
    // call time and throws if it isn't, so we widen the type here rather
    // than maintain a per-group method-name union (which would invert the
    // single-source-of-truth this refactor is meant to establish).
    commandRegistry.registerMethod(
      meta.name,
      instance,
      meta.routing.method as keyof typeof instance,
      meta
    )
  }
}

registerAllCommands()
