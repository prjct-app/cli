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
import { AnalyticsCommands } from './analytics'
import { CATEGORIES, COMMANDS } from './command-data'
import { ContextCommands } from './context'
import { MaintenanceCommands } from './maintenance'
import { PerformanceCommands } from './performance'
import { PlanningCommands } from './planning'
import { commandRegistry } from './registry'
import { SetupCommands } from './setup'
import { ShippingCommands } from './shipping'
import { UninstallCommands } from './uninstall'
import { UpdateCommands } from './update'
import { VelocityCommands } from './velocity'
import { WorkflowCommands } from './workflow'

// Singleton instances of command groups
const workflow = new WorkflowCommands()
const planning = new PlanningCommands()
const shipping = new ShippingCommands()
const analytics = new AnalyticsCommands()
const performance = new PerformanceCommands()
const maintenance = new MaintenanceCommands()
const analysis = new AnalysisCommands()
const setup = new SetupCommands()
const context = new ContextCommands()
const velocityCmd = new VelocityCommands()
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
  commandRegistry.registerMethod('done', workflow, 'done', getMeta('done'))
  commandRegistry.registerMethod('next', workflow, 'next', getMeta('next'))
  commandRegistry.registerMethod('pause', workflow, 'pause', getMeta('pause'))
  commandRegistry.registerMethod('resume', workflow, 'resume', getMeta('resume'))
  commandRegistry.registerMethod('workflow', workflow, 'workflow', getMeta('workflow'))

  // Planning commands
  commandRegistry.registerMethod('init', planning, 'init', getMeta('init'))
  commandRegistry.registerMethod('bug', planning, 'bug', getMeta('bug'))
  commandRegistry.registerMethod('idea', planning, 'idea', getMeta('idea'))
  commandRegistry.registerMethod('spec', planning, 'spec', getMeta('spec'))

  // Shipping commands
  commandRegistry.registerMethod('ship', shipping, 'ship', getMeta('ship'))

  // Analytics commands
  commandRegistry.registerMethod('dash', analytics, 'dash', getMeta('dash'))
  commandRegistry.registerMethod('help', analytics, 'help', getMeta('help'))

  // Performance commands
  commandRegistry.registerMethod('perf', performance, 'perf', getMeta('perf'))

  // Velocity commands
  commandRegistry.registerMethod('velocity', velocityCmd, 'velocity', getMeta('velocity'))

  // Maintenance commands
  commandRegistry.registerMethod('cleanup', maintenance, 'cleanup', getMeta('cleanup'))
  commandRegistry.registerMethod('design', maintenance, 'design', getMeta('design'))
  commandRegistry.registerMethod('recover', maintenance, 'recover', getMeta('recover'))
  commandRegistry.registerMethod('undo', maintenance, 'undo', getMeta('undo'))
  commandRegistry.registerMethod('redo', maintenance, 'redo', getMeta('redo'))
  commandRegistry.registerMethod('history', maintenance, 'history', getMeta('history'))

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
  commandRegistry.registerMethod('uninstall', uninstallCmd, 'uninstall', getMeta('uninstall'))
  commandRegistry.registerMethod('update', updateCmd, 'update', getMeta('update'))

  // Context command (for Claude templates)
  commandRegistry.registerMethod('context', context, 'context', getMeta('context'))
}

// Auto-register on import
registerAllCommands()

// Export command group instances for direct access (legacy support)
export {
  analysis,
  workflow,
  planning,
  shipping,
  analytics,
  performance,
  maintenance,
  setup,
  context,
  velocityCmd,
  uninstallCmd,
  updateCmd,
}
