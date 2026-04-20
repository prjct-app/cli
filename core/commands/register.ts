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
import { CATEGORIES, COMMANDS } from './command-data'
import { ContextCommands } from './context'
import { PlanningCommands } from './planning'
import { commandRegistry } from './registry'
import { SetupCommands } from './setup'
import { ShippingCommands } from './shipping'
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
const uninstallCmd = new UninstallCommands()
const updateCmd = new UpdateCommands()

/**
 * Register categories
 */
function registerCategories(): void {
  for (const [name, info] of Object.entries(CATEGORIES)) {
    commandRegistry.registerCategory(name, info)
  }
}

/**
 * Register all commands from existing command groups
 */
export function registerAllCommands(): void {
  // Skip if already registered
  if (commandRegistry.has('work')) return

  // Register categories first
  registerCategories()

  // Helper to get metadata from COMMANDS
  const getMeta = (name: string) => COMMANDS.find((c) => c.name === name)

  // Workflow commands
  commandRegistry.registerMethod('task', workflow, 'now', getMeta('task'))
  commandRegistry.registerMethod('done', workflow, 'done', getMeta('done'))
  commandRegistry.registerMethod('next', workflow, 'next', getMeta('next'))
  commandRegistry.registerMethod('pause', workflow, 'pause', getMeta('pause'))
  commandRegistry.registerMethod('resume', workflow, 'resume', getMeta('resume'))
  commandRegistry.registerMethod('workflow', workflow, 'workflow', getMeta('workflow'))
  commandRegistry.registerMethod('tokens', workflow, 'tokens', getMeta('tokens'))
  commandRegistry.registerMethod('sessions', workflow, 'sessions', getMeta('sessions'))

  // Planning commands
  commandRegistry.registerMethod('init', planning, 'init', getMeta('init'))

  // Shipping commands
  commandRegistry.registerMethod('ship', shipping, 'ship', getMeta('ship'))

  // Analysis commands
  commandRegistry.registerMethod('analyze', analysis, 'analyze', getMeta('analyze'))
  commandRegistry.registerMethod('sync', analysis, 'sync', getMeta('sync'))
  commandRegistry.registerMethod('stats', analysis, 'stats', getMeta('stats'))
  commandRegistry.registerMethod('status', analysis, 'status', getMeta('status'))
  commandRegistry.registerMethod('seal', analysis, 'seal', getMeta('seal'))
  commandRegistry.registerMethod('verify', analysis, 'verify', getMeta('verify'))

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
}

// Auto-register on import
registerAllCommands()

// Export command group instances for direct access
export { analysis, workflow, planning, shipping, setup, context, uninstallCmd, updateCmd }
