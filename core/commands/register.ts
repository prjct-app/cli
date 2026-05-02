/**
 * Command Registration - Bridges existing command groups to the registry
 *
 * This module registers all commands from the existing command groups
 * into the central CommandRegistry. This enables:
 * - Uniform command execution via registry.execute()
 * - Command introspection and metadata
 * - Future migration to pure handler pattern
 */

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
import { TeamCommands } from './team'
import { UninstallCommands } from './uninstall'
import { UpdateCommands } from './update'
import { WorkflowCommands } from './workflow'

// Singleton instances of command groups
const workflow = new WorkflowCommands()
const planning = new PlanningCommands()
const shipping = new ShippingCommands()
const analysis = new AnalysisCommands()
const setup = new SetupCommands()
const context = new ContextCommands()
const primitives = new PrimitiveCommands()
const uninstallCmd = new UninstallCommands()
const updateCmd = new UpdateCommands()
const seedCmd = new SeedCommands()
const installCmd = new InstallCommands()
const captureCmd = new CaptureCommands()
const mcpCmd = new McpCommands()
const teamCmd = new TeamCommands()
const configCmd = new ConfigCommands()

/**
 * Register categories
 */
function registerCategories(): void {
  for (const [name, info] of Object.entries(CATEGORIES)) {
    commandRegistry.registerCategory(name, info)
  }
}

/**
 * Register all commands from existing command groups.
 * Called once on module import (side-effect at the bottom of the file).
 */
function registerAllCommands(): void {
  // Skip if already registered
  if (commandRegistry.has('work')) return

  // Register categories first
  registerCategories()

  // Helper to get metadata from COMMANDS
  const getMeta = (name: string) => COMMANDS.find((c) => c.name === name)

  // Workflow commands
  commandRegistry.registerMethod('task', workflow, 'now', getMeta('task'))
  commandRegistry.registerMethod('workflow', workflow, 'workflow', getMeta('workflow'))

  // Planning commands
  commandRegistry.registerMethod('init', planning, 'init', getMeta('init'))

  // Shipping commands
  commandRegistry.registerMethod('ship', shipping, 'ship', getMeta('ship'))

  // Analysis commands (kept for internal sync workflow)
  commandRegistry.registerMethod('analyze', analysis, 'analyze', getMeta('analyze'))
  commandRegistry.registerMethod(
    'analysis-save-llm',
    analysis,
    'saveLlmAnalysis',
    getMeta('analysis-save-llm')
  )
  commandRegistry.registerMethod('sync', analysis, 'sync', getMeta('sync'))
  commandRegistry.registerMethod('regen', analysis, 'regenVault', getMeta('regen'))

  // Setup commands
  commandRegistry.registerMethod('start', setup, 'start', getMeta('start'))
  commandRegistry.registerMethod('setup', setup, 'setup', getMeta('setup'))
  commandRegistry.registerMethod('login', setup, 'login', getMeta('login'))
  commandRegistry.registerMethod('logout', setup, 'logout', getMeta('logout'))
  commandRegistry.registerMethod('auth', setup, 'auth', getMeta('auth'))
  commandRegistry.registerMethod('uninstall', uninstallCmd, 'uninstall', getMeta('uninstall'))
  commandRegistry.registerMethod('update', updateCmd, 'update', getMeta('update'))

  // Context command (for Claude templates)
  commandRegistry.registerMethod('context', context, 'context', getMeta('context'))

  // v2 primitives
  commandRegistry.registerMethod('status', primitives, 'status', getMeta('status'))
  commandRegistry.registerMethod('tag', primitives, 'tag', getMeta('tag'))
  commandRegistry.registerMethod('remember', primitives, 'remember', getMeta('remember'))

  // v2 alpha.8: pack system — seeds are declarative signals (memory types,
  // workflow slot names, hook signals). `seed` subcommands manage which
  // packs are active per project. `install` wires Claude Code hooks.
  commandRegistry.registerMethod('seed', seedCmd, 'seed', getMeta('seed'))
  commandRegistry.registerMethod('install', installCmd, 'install', getMeta('install'))

  // v2 alpha.9: `capture` — GTD inbox. Also the target of the bare
  // `prjct "<text>"` auto-route (replacing `task` — see core/index.ts).
  commandRegistry.registerMethod('capture', captureCmd, 'capture', getMeta('capture'))

  // Per-project MCP scoping — list/deny/allow MCP servers, persisted to
  // `.claude/settings.local.json` so other projects stay untouched.
  commandRegistry.registerMethod('mcp', mcpCmd, 'mcp', getMeta('mcp'))

  // M4: team mode. Writes .prjct/team.json + .claude/CLAUDE.md (per-project)
  // and stages them. Teammates pick up the same expectations from the repo.
  commandRegistry.registerMethod('team', teamCmd, 'team', getMeta('team'))

  // M5: global config (auto-update opt-in, suggestions toggle, …).
  commandRegistry.registerMethod('config', configCmd, 'config', getMeta('config'))
}

// Auto-register on import — this module is imported only for its side effect
// (see `core/index.ts` and `core/daemon/daemon.ts`).
registerAllCommands()
